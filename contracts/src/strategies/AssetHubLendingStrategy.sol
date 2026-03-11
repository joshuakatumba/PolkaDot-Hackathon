// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./YieldStrategy.sol";
import "../XCMRouter.sol";
import "../interfaces/IERC20.sol";

/// @title AssetHubLendingStrategy — XCM-based lending on Asset Hub
/// @notice Moves assets to Asset Hub and supplies them to a lending pool.
contract AssetHubLendingStrategy is YieldStrategy {
    address public owner;
    XCMRouter public xcmRouter;
    address public asset;
    
    uint256 public invested;
    uint256 public lastHarvested;

    event StrategyInvested(uint256 amount);
    event StrategyDivested(uint256 amount);

    constructor(address _xcmRouter, address _asset) {
        owner = msg.sender;
        xcmRouter = XCMRouter(_xcmRouter);
        asset = _asset;
    }

    function invest(uint256 amount) external override {
        require(amount > 0, "Lending: zero amount");
        
        // Build XCM to move assets to Asset Hub and Supply to Pool
        bytes memory payload = xcmRouter.buildLendOnAssetHub(asset, amount);
        
        // Send via router
        xcmRouter.sendToAssetHub(payload);
        
        invested += amount;
        emit StrategyInvested(amount);
    }

    function divest(uint256 amount) external override {
        require(amount <= invested, "Lending: insufficient");
        invested -= amount;
        emit StrategyDivested(amount);
    }

    function totalValue() external view override returns (uint256) {
        return invested;
    }

    function harvestYield() external override returns (uint256) {
        // Simulate a 10% APY for lending
        uint256 timePassed = block.timestamp - lastHarvested;
        if (timePassed < 1 hours) return 0;

        uint256 yield = (invested * 10 * timePassed) / (100 * 365 days);
        lastHarvested = block.timestamp;
        return yield;
    }
}
