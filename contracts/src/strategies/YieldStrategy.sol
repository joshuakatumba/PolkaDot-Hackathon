// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title YieldStrategy — Abstract base for vault yield strategies
abstract contract YieldStrategy {
    /// @notice Invest assets into the strategy.
    function invest(uint256 amount) external virtual;

    /// @notice Divest assets from the strategy.
    function divest(uint256 amount) external virtual;

    /// @notice Total value currently held by the strategy.
    function totalValue() external view virtual returns (uint256);

    /// @notice Harvest accrued yield and return the amount.
    function harvestYield() external virtual returns (uint256);
}

/// @title DOTStakingStrategy — Simulated DOT staking for demo
/// @notice In a hackathon demo, this simulates yield accrual.
contract DOTStakingStrategy is YieldStrategy {
    address public owner;
    uint256 public invested;
    uint256 public accruedYield;

    /// @notice Yield rate per harvest call (basis points, e.g. 50 = 0.5%)
    uint256 public yieldRateBps = 50;

    event Invested(uint256 amount);
    event Divested(uint256 amount);
    event YieldHarvested(uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function invest(uint256 amount) external override {
        invested += amount;
        emit Invested(amount);
    }

    function divest(uint256 amount) external override {
        require(amount <= invested, "DOTStaking: insufficient");
        invested -= amount;
        emit Divested(amount);
    }

    function totalValue() external view override returns (uint256) {
        return invested + accruedYield;
    }

    /// @notice Simulate yield accrual: adds yieldRateBps of invested as yield.
    function harvestYield() external override returns (uint256) {
        uint256 newYield = (invested * yieldRateBps) / 10000;
        accruedYield += newYield;
        emit YieldHarvested(newYield);
        return newYield;
    }

    /// @notice Owner can adjust yield rate for demo purposes.
    function setYieldRate(uint256 _bps) external {
        require(msg.sender == owner, "DOTStaking: not owner");
        yieldRateBps = _bps;
    }
}

/// @title LendingStrategy — Simulated lending pool for demo
contract LendingStrategy is YieldStrategy {
    address public owner;
    uint256 public invested;
    uint256 public accruedYield;
    uint256 public yieldRateBps = 30; // 0.3% per harvest

    event Invested(uint256 amount);
    event Divested(uint256 amount);
    event YieldHarvested(uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function invest(uint256 amount) external override {
        invested += amount;
        emit Invested(amount);
    }

    function divest(uint256 amount) external override {
        require(amount <= invested, "Lending: insufficient");
        invested -= amount;
        emit Divested(amount);
    }

    function totalValue() external view override returns (uint256) {
        return invested + accruedYield;
    }

    function harvestYield() external override returns (uint256) {
        uint256 newYield = (invested * yieldRateBps) / 10000;
        accruedYield += newYield;
        emit YieldHarvested(newYield);
        return newYield;
    }

    function setYieldRate(uint256 _bps) external {
        require(msg.sender == owner, "Lending: not owner");
        yieldRateBps = _bps;
    }
}
