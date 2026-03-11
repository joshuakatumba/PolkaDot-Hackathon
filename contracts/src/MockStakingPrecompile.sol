// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStaking.sol";

/**
 * @title MockStakingPrecompile
 * @notice Mocks the behavior of the Polkadot Hub Staking Precompile for local testing.
 */
contract MockStakingPrecompile is IStaking {
    mapping(address => uint256) public bondedBalances;
    mapping(address => uint256) public userRewards;

    function bond(uint256 amount, uint8 /*payee*/) external override {
        bondedBalances[msg.sender] += amount;
    }

    function nominate(address[] calldata /*targets*/) external override {
        // Mock success
    }

    function bondExtra(uint256 amount) external override {
        bondedBalances[msg.sender] += amount;
    }

    function unbond(uint256 amount) external override {
        require(bondedBalances[msg.sender] >= amount, "MockStaking: insufficient");
        bondedBalances[msg.sender] -= amount;
    }

    function withdrawUnbonded() external override {
        // Mock success
    }

    function bonded(address account) external view override returns (uint256) {
        return bondedBalances[account];
    }

    function rewards(address account) external view override returns (uint256) {
        return userRewards[account];
    }

    // Helper for simulation
    function setRewards(address account, uint256 amount) external {
        userRewards[account] = amount;
    }
}
