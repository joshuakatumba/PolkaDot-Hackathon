// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./YieldStrategy.sol";
import "../XCMRouter.sol";
import "../interfaces/IERC20.sol";

/// @title PolkadotStakingStrategy — Real XCM-based DOT staking
/// @notice Deploys DOT to the Polkadot Relay chain via XCM for native staking.
contract PolkadotStakingStrategy is YieldStrategy {
    address public owner;
    XCMRouter public xcmRouter;
    address public dotAsset;
    
    uint256 public invested;
    uint256 public lastHarvested;

    event StrategyInvested(uint256 amount);
    event StrategyDivested(uint256 amount);

    constructor(address _xcmRouter, address _dotAsset) {
        owner = msg.sender;
        xcmRouter = XCMRouter(_xcmRouter);
        dotAsset = _dotAsset;
    }

    function invest(uint256 amount) external override {
        require(amount > 0, "PolkadotStaking: zero amount");
        
        // 1. Move assets to this contract (done by AutoTreasury)
        // 2. Build XCM to move DOT to Relay and Bond
        bytes memory payload = xcmRouter.buildStakeOnRelay(amount);
        
        // 3. Send via router
        xcmRouter.sendToRelay(payload);
        
        invested += amount;
        emit StrategyInvested(amount);
    }

    function divest(uint256 amount) external override {
        require(amount <= invested, "PolkadotStaking: insufficient");
        // In reality, this would trigger an Unbond XCM with a 28-day delay.
        // For the demo, we update state immediately.
        invested -= amount;
        emit StrategyDivested(amount);
    }

    function totalValue() external view override returns (uint256) {
        return invested;
    }

    function harvestYield() external override returns (uint256) {
        // Real yield would be harvested from the Relay chain via XCM.
        // We simulate a 15% APY harvest here for the dashboard.
        uint256 timePassed = block.timestamp - lastHarvested;
        if (timePassed < 1 hours) return 0;

        uint256 yield = (invested * 15 * timePassed) / (100 * 365 days);
        lastHarvested = block.timestamp;
        return yield;
    }
}
