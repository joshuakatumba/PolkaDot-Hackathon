// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IXcm.sol";

/**
 * @title MockXcm
 * @notice Mocks the Polkadot Hub XCM precompile for testing.
 */
contract MockXcm is IXcm {
    event XcmSent(bytes dest, bytes message);
    event XcmExecuted(bytes message);

    function execute(
        bytes calldata message,
        bytes calldata /*maxWeight*/
    ) external override returns (bool success) {
        emit XcmExecuted(message);
        return true;
    }

    function send(
        bytes calldata dest,
        bytes calldata message
    ) external override returns (bool success) {
        emit XcmSent(dest, message);
        return true;
    }

    function weighMessage(
        bytes calldata /*message*/
    ) external pure override returns (uint64 refTime, uint64 proofSize) {
        return (1000000, 100);
    }
}
