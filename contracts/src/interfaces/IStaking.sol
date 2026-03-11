// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStaking
 * @notice Interface for the Polkadot Hub Staking Precompile (Proxy to Relay Chain Staking)
 * @dev Precompile address typically at 0x0000000000000000000000000000000000000803
 */
interface IStaking {
    /**
     * @notice Bond DOT on the Relay chain via the EVM account.
     * @param amount The amount of DOT to bond.
     * @param payee The reward destination (0 for Staked, 1 for Stash, 2 for Controller).
     */
    function bond(uint256 amount, uint8 payee) external;

    /**
     * @notice Nominate a list of validators.
     * @param targets Array of validator addresses on the Relay chain.
     */
    function nominate(address[] calldata targets) external;

    /**
     * @notice Bond extra DOT to an existing stash.
     * @param amount The amount of extra DOT to bond.
     */
    function bondExtra(uint256 amount) external;

    /**
     * @notice Unbond a specific amount of DOT.
     * @param amount The amount to unbond.
     */
    function unbond(uint256 amount) external;

    /**
     * @notice Withdraw any unbonded funds that have passed the unbonding period.
     */
    function withdrawUnbonded() external;

    /**
     * @notice Get the bonded amount for an account.
     */
    function bonded(address account) external view returns (uint256);

    /**
     * @notice Get the total staking rewards accrued for an account (simulated/indexed from relay).
     */
    function rewards(address account) external view returns (uint256);
}
