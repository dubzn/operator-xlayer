// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorVault} from "./OperatorVault.sol";
import {IExecutionRegistry} from "./interfaces/IExecutionRegistry.sol";

/// @notice Factory that lets any user deploy their own OperatorVault and
///         auto-registers it in the ExecutionRegistry.
contract VaultFactory {
    IExecutionRegistry public immutable registry;
    address public immutable operator;
    address public immutable trustedRouter;

    address[] public vaults;
    mapping(address => address[]) public vaultsByOwner;

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address baseToken
    );

    constructor(
        address _registry,
        address _operator,
        address _trustedRouter
    ) {
        registry = IExecutionRegistry(_registry);
        operator = _operator;
        trustedRouter = _trustedRouter;
    }

    /// @notice Deploy a new vault. Caller becomes the owner.
    function createVault(
        address baseToken,
        uint256 maxAmountPerTrade,
        uint256 maxDailyVolume,
        uint256 maxSlippageBps,
        uint256 cooldownSeconds
    ) external returns (address) {
        OperatorVault vault = new OperatorVault(
            msg.sender,      // owner = caller
            baseToken,
            operator,        // shared operator across all vaults
            trustedRouter,   // shared router across all vaults
            maxAmountPerTrade,
            maxDailyVolume,
            maxSlippageBps,
            cooldownSeconds
        );

        address vaultAddr = address(vault);
        vaults.push(vaultAddr);
        vaultsByOwner[msg.sender].push(vaultAddr);

        // Auto-register vault in the registry
        registry.authorizeVault(vaultAddr);

        emit VaultCreated(msg.sender, vaultAddr, baseToken);

        return vaultAddr;
    }

    function getVaultCount() external view returns (uint256) {
        return vaults.length;
    }

    function getVaultsByOwner(address owner) external view returns (address[] memory) {
        return vaultsByOwner[owner];
    }
}
