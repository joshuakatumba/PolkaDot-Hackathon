// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IXcm.sol";
import "./XCMRouter.sol";
import "./strategies/YieldStrategy.sol";

/// @title AutoTreasury — Cross-Chain Yield Vault on Polkadot Hub
/// @notice Accepts ecosystem assets, routes them to AssetHub via XCM,
///         swaps to optimal yield assets, and deploys into yield strategies.
contract AutoTreasury {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    address public owner;
    XCMRouter public xcmRouter;

    /// @notice Vault share balances
    mapping(address => uint256) public shares;
    uint256 public totalShares;

    /// @notice Supported deposit assets
    mapping(address => bool) public supportedAssets;
    address[] public assetList;

    /// @notice Total deposited per asset (before XCM routing)
    mapping(address => uint256) public totalDeposited;

    /// @notice Registered yield strategies
    YieldStrategy[] public strategies;
    mapping(address => uint256) public strategyIndex; // strategy addr → index+1

    /// @notice Global yield accrued (simplified accounting)
    uint256 public totalYieldAccrued;
    mapping(address => uint256) public yieldClaimed;

    /// @notice Security & Fees
    bool public paused;
    uint256 public protocolFeeBps = 200; // 2% protocol fee
    uint256 public totalFeesAccrued;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposited(address indexed user, address indexed asset, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed user, uint256 sharesBurned, uint256 amountReturned);
    event XCMTransferTriggered(address indexed asset, uint256 amount, bytes xcmPayload);
    event Rebalanced(uint256 timestamp);
    event YieldClaimed(address indexed user, uint256 amount);
    event StrategyAdded(address indexed strategy);
    event StrategyRemoved(address indexed strategy);
    event AssetAdded(address indexed asset);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AutoTreasury: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "AutoTreasury: paused");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _xcmRouter) {
        owner = msg.sender;
        xcmRouter = XCMRouter(_xcmRouter);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Add a supported deposit asset
    function addAsset(address asset) external onlyOwner {
        require(!supportedAssets[asset], "AutoTreasury: already supported");
        supportedAssets[asset] = true;
        assetList.push(asset);
        emit AssetAdded(asset);
    }

    /// @notice Register a yield strategy
    function addStrategy(YieldStrategy strategy) external onlyOwner {
        require(strategyIndex[address(strategy)] == 0, "AutoTreasury: strategy exists");
        strategies.push(strategy);
        strategyIndex[address(strategy)] = strategies.length; // 1-indexed
        emit StrategyAdded(address(strategy));
    }

    /// @notice Remove a yield strategy (swap with last & pop)
    function removeStrategy(YieldStrategy strategy) external onlyOwner {
        uint256 idx = strategyIndex[address(strategy)];
        require(idx != 0, "AutoTreasury: strategy not found");
        uint256 lastIdx = strategies.length - 1;
        if (idx - 1 != lastIdx) {
            strategies[idx - 1] = strategies[lastIdx];
            strategyIndex[address(strategies[lastIdx])] = idx;
        }
        strategies.pop();
        delete strategyIndex[address(strategy)];
        emit StrategyRemoved(address(strategy));
    }

    /// @notice Security: Pause/Unpause core functions
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /// @notice Security: Emergency withdraw of tokens from the vault (admin only)
    function emergencyWithdraw(address asset, uint256 amount) external onlyOwner {
        IERC20(asset).transfer(owner, amount);
    }

    // ──────────────────────────────────────────────
    //  Core — Deposit
    // ──────────────────────────────────────────────

    /// @notice Deposit a supported asset into the vault and receive shares.
    /// @param asset  ERC-20 token address
    /// @param amount  Amount to deposit (must have approved this contract)
    function deposit(address asset, uint256 amount) external whenNotPaused {
        require(supportedAssets[asset], "AutoTreasury: unsupported asset");
        require(amount > 0, "AutoTreasury: zero amount");

        // Get total assets BEFORE transfer
        uint256 totalVal = totalAssets();

        // Transfer tokens in
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // Calculate shares
        uint256 sharesToMint;
        if (totalShares == 0) {
            sharesToMint = amount;
        } else {
            sharesToMint = (amount * totalShares) / totalVal;
        }

        shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;
        totalDeposited[asset] += amount;

        emit Deposited(msg.sender, asset, amount, sharesToMint);
    }

    // ──────────────────────────────────────────────
    //  Core — Withdraw
    // ──────────────────────────────────────────────

    /// @notice Burn shares and withdraw proportional value.
    /// @param shareAmount  Number of shares to redeem
    function withdraw(uint256 shareAmount) external whenNotPaused {
        require(shareAmount > 0, "AutoTreasury: zero shares");
        require(shares[msg.sender] >= shareAmount, "AutoTreasury: insufficient shares");

        uint256 totalVal = totalAssets();
        uint256 payout = (shareAmount * totalVal) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        // Liquidity Management: Pull from strategies if necessary
        uint256 vaultBal = IERC20(assetList[0]).balanceOf(address(this)); // Primary asset
        if (vaultBal < payout) {
            uint256 short = payout - vaultBal;
            for (uint256 i = 0; i < strategies.length; i++) {
                uint256 stratVal = strategies[i].totalValue();
                uint256 pull = short > stratVal ? stratVal : short;
                if (pull > 0) {
                    strategies[i].divest(pull);
                    short -= pull;
                    if (short == 0) break;
                }
            }
        }

        // Final transfer
        IERC20(assetList[0]).transfer(msg.sender, payout);
        totalDeposited[assetList[0]] -= payout;

        emit Withdrawn(msg.sender, shareAmount, payout);
    }

    // ──────────────────────────────────────────────
    //  Core — XCM Transfer
    // ──────────────────────────────────────────────

    /// @notice Trigger an XCM transfer of a vault-held asset to AssetHub.
    /// @param asset  Token to transfer
    /// @param amount  Amount to send cross-chain
    function triggerXCMTransfer(address asset, uint256 amount) external onlyOwner {
        require(amount > 0, "AutoTreasury: zero amount");
        uint256 bal = IERC20(asset).balanceOf(address(this));
        require(bal >= amount, "AutoTreasury: insufficient balance");

        // Approve router to spend tokens
        IERC20(asset).approve(address(xcmRouter), amount);

        // Build & send XCM payload
        bytes memory payload = xcmRouter.buildTransferToAssetHub(asset, amount);
        xcmRouter.sendToAssetHub(payload);

        emit XCMTransferTriggered(asset, amount, payload);
    }

    // ──────────────────────────────────────────────
    //  Core — Rebalance
    // ──────────────────────────────────────────────

    /// @notice Re-allocate vault assets across yield strategies.
    /// @dev Track 2 (PVM) logic: Splits assets between Native Staking and DeFi Lending.
    function rebalance() external onlyOwner {
        uint256 stratCount = strategies.length;
        require(stratCount > 0, "AutoTreasury: no strategies");

        for (uint256 i = 0; i < assetList.length; i++) {
            address asset = assetList[i];
            uint256 bal = IERC20(asset).balanceOf(address(this));
            
            if (bal < 1e15) continue; // Skip dusting

            // Track 2 Hybrid Logic:
            // 1. If DOT: Split 50% Native Staking, 50% DeFi Lending
            // 2. Others: 100% DeFi Lending
            for (uint256 j = 0; j < stratCount; j++) {
                uint256 splitAmount = 0;
                
                // Identify strategy type (Simplified for demo)
                // In production, use strategy metadata or interfaces
                bool isNative = (j == 0); // Assume strategy 0 is NativeStakingStrategy
                
                if (asset == assetList[0]) { // Assume asset[0] is DOT
                    splitAmount = bal / 2;
                } else {
                    splitAmount = isNative ? 0 : bal;
                }

                if (splitAmount > 0) {
                    IERC20(asset).transfer(address(strategies[j]), splitAmount);
                    strategies[j].invest(splitAmount);
                }
            }
        }

        emit Rebalanced(block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Core — Yield
    // ──────────────────────────────────────────────

    /// @notice Claim accrued yield for the caller.
    function claimYield() external {
        uint256 userShare = shares[msg.sender];
        require(userShare > 0, "AutoTreasury: no shares");

        // Harvest from all strategies
        uint256 freshYield = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            freshYield += strategies[i].harvestYield();
        }
        
        // Protocol Fee Deduction (2%)
        uint256 fee = (freshYield * protocolFeeBps) / 10000;
        totalFeesAccrued += fee;
        freshYield -= fee;

        totalYieldAccrued += freshYield;

        // Proportional yield for this user
        uint256 entitled = (totalYieldAccrued * userShare) / totalShares;
        uint256 claimable = entitled - yieldClaimed[msg.sender];
        require(claimable > 0, "AutoTreasury: nothing to claim");

        yieldClaimed[msg.sender] = entitled;

        // Transfer yield (from DOT - simplified for demo)
        IERC20(assetList[0]).transfer(msg.sender, claimable);

        emit YieldClaimed(msg.sender, claimable);
    }

    /// @notice Collect protocol fees (admin only)
    function collectFees() external onlyOwner {
        uint256 amount = totalFeesAccrued;
        totalFeesAccrued = 0;
        IERC20(assetList[0]).transfer(owner, amount);
    }

    // ──────────────────────────────────────────────
    //  View Helpers
    // ──────────────────────────────────────────────

    /// @notice Total value held by vault (deposits + strategy balances).
    function totalAssets() public view returns (uint256) {
        uint256 total = 0;
        // Vault-held balances
        for (uint256 i = 0; i < assetList.length; i++) {
            total += IERC20(assetList[i]).balanceOf(address(this));
        }
        // Strategy-held balances
        for (uint256 i = 0; i < strategies.length; i++) {
            total += strategies[i].totalValue();
        }
        return total;
    }

    /// @notice Price of one share in asset terms.
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets() * 1e18) / totalShares;
    }

    /// @notice Number of supported assets.
    function assetCount() external view returns (uint256) {
        return assetList.length;
    }

    /// @notice Number of registered strategies.
    function strategyCount() external view returns (uint256) {
        return strategies.length;
    }

    /// @notice User's claimable yield.
    function pendingYield(address user) external view returns (uint256) {
        if (totalShares == 0 || shares[user] == 0) return 0;
        uint256 entitled = (totalYieldAccrued * shares[user]) / totalShares;
        return entitled > yieldClaimed[user] ? entitled - yieldClaimed[user] : 0;
    }
}
