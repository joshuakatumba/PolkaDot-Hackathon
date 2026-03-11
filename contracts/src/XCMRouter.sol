// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IXcm.sol";
import "./interfaces/IStaking.sol";

/// @title XCMRouter — Builds and sends XCM messages to AssetHub and Relay
/// @notice Encodes cross-chain transfer and pallet-interaction payloads.
contract XCMRouter {
    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice XCM Transactor precompile address standard on Polkadot Hub / Frontier EVM.
    address public XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

    /// @notice Staking precompile address (standard for Hub/Frontier EVM).
    address public STAKING_PRECOMPILE = 0x0000000000000000000000000000000000000803;

    /// @notice Parachain IDs
    uint32 public constant ASSET_HUB_PARA_ID = 1000;
    uint32 public constant RELAY_CHAIN_ID = 0; // Parents = 1 to reach relay

    address public owner;
    address public treasury;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event XCMSent(bytes dest, bytes message);
    event XCMExecuted(bytes message);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyTreasury() {
        require(msg.sender == treasury || msg.sender == owner, "XCMRouter: unauthorized");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    /// @notice Set the AutoTreasury contract address.
    function setTreasury(address _treasury) external {
        require(msg.sender == owner, "XCMRouter: not owner");
        treasury = _treasury;
    }

    function setPrecompileAddresses(address _xcm, address _staking) external {
        require(msg.sender == owner, "XCMRouter: not owner");
        XCM_PRECOMPILE = _xcm;
        STAKING_PRECOMPILE = _staking;
    }

    // ──────────────────────────────────────────────
    //  XCM Payload Builders (Core)
    // ──────────────────────────────────────────────

    function buildTransferToAssetHub(
        address asset,
        uint256 amount
    ) external pure returns (bytes memory payload) {
        bytes memory destination = _encodeParachainDestination(ASSET_HUB_PARA_ID);
        bytes memory assetId = _encodeAssetMultiLocation(asset);
        bytes memory instructions = _encodeTransferInstructions(assetId, amount);

        payload = abi.encodePacked(
            hex"04",             // V4 version prefix
            destination,
            instructions
        );
    }

    /// @notice Build a stake (bond) instruction for the Relay chain.
    function buildStakeOnRelay(uint256 amount) external pure returns (bytes memory payload) {
        bytes memory destination = _encodeRelayDestination();
        
        // Transact to Staking::bond(value, payee)
        // For demo: call index [7, 0]
        bytes memory call = abi.encodePacked(
            hex"0700",           // Staking pallet (7), bond call (0)
            uint128(amount),     // value
            uint8(0)             // Payee::Staked (0)
        );

        payload = abi.encodePacked(
            hex"04",             // V4
            destination,
            _encodeTransact(call)
        );
    }

    /// @notice Build a lending interaction for Asset Hub.
    function buildLendOnAssetHub(address asset, uint256 amount) external pure returns (bytes memory payload) {
        bytes memory destination = _encodeParachainDestination(ASSET_HUB_PARA_ID);
        
        // Example: Pool::supply(asset, amount)
        bytes memory call = abi.encodePacked(
            hex"1403",           // Dummy pallet/call for Lending
            _encodeAssetMultiLocation(asset),
            uint128(amount)
        );

        payload = abi.encodePacked(
            hex"04",
            destination,
            _encodeTransact(call)
        );
    }

    // ──────────────────────────────────────────────
    //  Send / Execute
    // ──────────────────────────────────────────────

    function sendToAssetHub(bytes memory payload) external onlyTreasury {
        bytes memory dest = _encodeParachainDestination(ASSET_HUB_PARA_ID);
        (bool success) = IXcm(XCM_PRECOMPILE).send(dest, payload);
        require(success, "XCMRouter: send failed");
        emit XCMSent(dest, payload);
    }

    function sendToRelay(bytes memory payload) external onlyTreasury {
        bytes memory dest = _encodeRelayDestination();
        (bool success) = IXcm(XCM_PRECOMPILE).send(dest, payload);
        require(success, "XCMRouter: send failed");
        emit XCMSent(dest, payload);
    }

    // ──────────────────────────────────────────────
    //  Native Staking Functions (Track 2 - PVM)
    // ──────────────────────────────────────────────

    /**
     * @notice Bond DOT directly on Polkadot Hub (acting as Proxy for Relay).
     * @param amount The amount to bond.
     */
    function nativeBond(uint256 amount) external onlyTreasury {
        IStaking(STAKING_PRECOMPILE).bond(amount, 0); // Payee::Staked
    }

    /**
     * @notice Nominate validators via the native precompile.
     * @param targets Array of validator addresses.
     */
    function nativeNominate(address[] calldata targets) external onlyTreasury {
        IStaking(STAKING_PRECOMPILE).nominate(targets);
    }

    /**
     * @notice Unbond funds from native staking.
     * @param amount The amount to unbond.
     */
    function nativeUnbond(uint256 amount) external onlyTreasury {
        IStaking(STAKING_PRECOMPILE).unbond(amount);
    }

    /**
     * @notice Query bonded balance from native precompile.
     */
    function getNativeBonded(address account) external view returns (uint256) {
        return IStaking(STAKING_PRECOMPILE).bonded(account);
    }

    // ──────────────────────────────────────────────
    //  Internal Encoders (V4 Standard)
    // ──────────────────────────────────────────────

    function _encodeParachainDestination(uint32 paraId) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(1),                        // parents = 1 (to reach Asset Hub from this para)
            uint8(1),                        // interior: X1
            uint8(0),                        // Junction::Parachain
            paraId
        );
    }

    function _encodeRelayDestination() internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(1),                        // parents = 1
            uint8(0)                         // interior: Here
        );
    }

    function _encodeAssetMultiLocation(address asset) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(0),                        // parents = 0
            uint8(1),                        // interior: X1
            uint8(5),                        // Junction::AccountKey20
            asset
        );
    }

    function _encodeTransferInstructions(bytes memory assetId, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(0), assetId, uint128(amount), // WithdrawAsset
            uint8(13), uint8(0),                // ClearOrigin
            uint8(12), assetId, uint128(amount / 100), // BuyExecution (1%)
            uint8(4), uint8(0), uint8(0)        // DepositAsset (All, Wild)
        );
    }

    function _encodeTransact(bytes memory call) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(6),                        // Transact index
            uint8(0),                        // OriginKind::Native
            uint8(1),                        // RequireWeightAtMost (v4)
            uint64(1000000000), uint64(10000), // Weight (refTime, proofSize)
            call
        );
    }
}
