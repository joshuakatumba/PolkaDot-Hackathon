// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IXcm.sol";
import "./XCMRouter.sol";
import "./strategies/YieldStrategy.sol";

/**
 * @title AutoTreasury — Hybrid Savings & Cross-Chain Payment Platform
 * @notice Protects users' principal (savings) while allowing them to use
 *         accrued yield to pay for services across the Polkadot ecosystem via XCM.
 */
contract AutoTreasury {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    address public owner;
    XCMRouter public xcmRouter;

    /// @notice Principal balances (unspent savings)
    mapping(address => uint256) public principal;
    uint256 public totalPrincipal;

    /// @notice Spendable yield balances
    mapping(address => uint256) public spendableYield;
    uint256 public totalSpendableYield;

    /// @notice Vault share balances (for proportional yield distribution)
    mapping(address => uint256) public shares;
    uint256 public totalShares;

    /// @notice Supported deposit asset (Primary: DOT)
    address public primaryAsset;

    /// @notice Registered yield strategies
    YieldStrategy[] public strategies;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Saved(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 principalAmount);
    event YieldHarvested(uint256 totalYield);
    event CrossChainPayment(address indexed user, uint32 targetParaId, address targetAsset, uint256 yieldAmount);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AutoTreasury: not owner");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _xcmRouter, address _primaryAsset) {
        owner = msg.sender;
        xcmRouter = XCMRouter(_xcmRouter);
        primaryAsset = _primaryAsset;
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function addStrategy(YieldStrategy strategy) external onlyOwner {
        strategies.push(strategy);
    }

    // ──────────────────────────────────────────────
    //  Core — Savings (Principal)
    // ──────────────────────────────────────────────

    /**
     * @notice Deposit funds into the savings vault.
     * @param amount The amount of primary asset to save.
     */
    function save(uint256 amount) external {
        require(amount > 0, "AutoTreasury: zero amount");
        
        // Harvest yield before updating shares to ensure fair distribution
        _harvestAll();

        IERC20(primaryAsset).transferFrom(msg.sender, address(this), amount);

        // Principal protection: shares track the locked principal
        uint256 sharesToMint;
        if (totalShares == 0) {
            sharesToMint = amount;
        } else {
            // New shares are minted 1:1 with principal relative to existing total
            sharesToMint = (amount * totalShares) / totalPrincipal;
        }

        principal[msg.sender] += amount;
        totalPrincipal += amount;
        
        shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;

        emit Saved(msg.sender, amount);
    }

    /**
     * @notice Withdraw principal from savings. Yield earned remains in spendableYield.
     * @param amount The amount of principal to withdraw.
     */
    function withdrawPrincipal(uint256 amount) external {
        require(amount > 0 && principal[msg.sender] >= amount, "AutoTreasury: insufficient principal");
        
        _harvestAll();

        uint256 shareAmount = (amount * totalShares) / totalPrincipal;
        
        principal[msg.sender] -= amount;
        totalPrincipal -= amount;
        
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        // Check buffer and divest if needed
        uint256 vaultBal = IERC20(primaryAsset).balanceOf(address(this));
        if (vaultBal < amount) {
            _divestFromStrategies(amount - vaultBal);
        }

        IERC20(primaryAsset).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    //  Core — Cross-Chain Yield Spending
    // ──────────────────────────────────────────────

    /**
     * @notice Pay for a service on another parachain using ONLY accrued yield.
     * @param targetParaId Destination Parachain ID.
     * @param targetAsset The asset expected on the destination chain.
     * @param yieldAmount Amount of primary asset (yield) to spend.
     */
    function payWithYield(
        uint32 targetParaId,
        address targetAsset,
        uint256 yieldAmount
    ) external {
        _harvestAll();
        require(spendableYield[msg.sender] >= yieldAmount, "AutoTreasury: insufficient yield");

        spendableYield[msg.sender] -= yieldAmount;
        totalSpendableYield -= yieldAmount;

        // 1. Build Swap Payload: primaryAsset -> targetAsset on Asset Hub
        // 2. Wrap payload with Transfer to targetParaId
        // For simplicity in this demo, we use the buildSwapOnAssetHub we created
        // and send it via XCMRouter.
        
        // In a real flow, this would be a swap_and_send logic.
        bytes memory swapPayload = xcmRouter.buildSwapOnAssetHub(
            primaryAsset,
            targetAsset,
            yieldAmount,
            0 // minAmountOut
        );

        // Approve router for yield amount
        IERC20(primaryAsset).approve(address(xcmRouter), yieldAmount);
        
        // Route via XCM
        xcmRouter.sendToAssetHub(swapPayload);

        emit CrossChainPayment(msg.sender, targetParaId, targetAsset, yieldAmount);
    }

    // ──────────────────────────────────────────────
    //  Internal Logic
    // ──────────────────────────────────────────────

    function _harvestAll() internal {
        if (totalShares == 0) return;

        uint256 harvested = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            harvested += strategies[i].harvestYield();
        }

        if (harvested > 0) {
            // Distribute yield to all shareholders
            totalSpendableYield += harvested;
            
            // In a production contract, we would use a 'points-per-share' model
            // to avoid O(N) loops. For this demo, we'll update global state
            // and users will claim their share when they interact.
            // Simplified: User's total entitlements = (harvested * userShare) / totalShares
            // For this POC, we'll track the "last harvested" yield globally.
            _distributeYield(harvested);
            emit YieldHarvested(harvested);
        }
    }

    /**
     * @notice Simplified yield distribution for the demo.
     */
    function _distributeYield(uint256 amount) internal {
        // In a real vault, we'd use a cumulative 'rewardPerShare' accumulator.
        // For the hackathon demo, we'll simulate the distribution to the caller.
        // Direct O(N) update of all users is impossible on-chain.
        
        // Mocking: Assume the caller is the primary beneficiary for the demo logs
        spendableYield[msg.sender] += (amount * shares[msg.sender]) / totalShares;
    }

    function _divestFromStrategies(uint256 amount) internal {
        uint256 remaining = amount;
        for (uint256 i = 0; i < strategies.length; i++) {
            uint256 stratVal = strategies[i].totalValue();
            uint256 pull = remaining > stratVal ? stratVal : remaining;
            if (pull > 0) {
                strategies[i].divest(pull);
                remaining -= pull;
                if (remaining == 0) break;
            }
        }
    }

    function rebalance() external onlyOwner {
        uint256 bal = IERC20(primaryAsset).balanceOf(address(this));
        // Keep 10% as liquid buffer, invest 90%
        uint256 toInvest = (bal * 90) / 100;
        
        if (toInvest > 0 && strategies.length > 0) {
            uint256 split = toInvest / strategies.length;
            for (uint256 i = 0; i < strategies.length; i++) {
                IERC20(primaryAsset).transfer(address(strategies[i]), split);
                strategies[i].invest(split);
            }
        }
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function totalAssets() public view returns (uint256) {
        uint256 val = IERC20(primaryAsset).balanceOf(address(this));
        for (uint256 i = 0; i < strategies.length; i++) {
            val += strategies[i].totalValue();
        }
        return val;
    }

    function strategyCount() external view returns (uint256) {
        return strategies.length;
    }

    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets() * 1e18) / totalShares;
    }
}