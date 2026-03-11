// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IXcm — Polkadot Hub XCM Precompile Interface
/// @notice Fixed address: 0x00000000000000000000000000000000000a0000
/// @dev Low-level interface exposing execute, send, and weighMessage.
interface IXcm {
    /// @notice Execute an XCM message locally on this chain.
    /// @param message  SCALE-encoded VersionedXcm<Call>
    /// @param maxWeight  (refTime, proofSize) tuple encoded as bytes
    /// @return success  Whether execution succeeded
    function execute(
        bytes calldata message,
        bytes calldata maxWeight
    ) external returns (bool success);

    /// @notice Send an XCM message to another consensus system.
    /// @param dest  SCALE-encoded VersionedLocation (destination chain)
    /// @param message  SCALE-encoded VersionedXcm<()>
    /// @return success  Whether the message was successfully queued
    function send(
        bytes calldata dest,
        bytes calldata message
    ) external returns (bool success);

    /// @notice Estimate the weight of an XCM message.
    /// @param message  SCALE-encoded VersionedXcm<Call>
    /// @return refTime  Execution time weight
    /// @return proofSize  Proof size weight
    function weighMessage(
        bytes calldata message
    ) external view returns (uint64 refTime, uint64 proofSize);
}
