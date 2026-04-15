// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";

contract DeployFactory is Script {
    function run() external {
        // Reuse existing deployed contracts on X Layer mainnet
        address registry = 0x92bA6C8cc60Dfd41D25D4bA0F3d771DAC7009A66;
        address operator = 0xF88A50ef4CfCAa82021D6b362530bc0887cB570b;
        address swapAdapter = 0x12b5152aAA2Ef6DA029b4a5BAfef1bF6465bd0c4;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Deploy new VaultFactory (now includes registry.authorizeVault in createVault)
        VaultFactory factory = new VaultFactory(registry, operator, swapAdapter);
        console.log("VaultFactory:", address(factory));

        // 2. Authorize new factory in the existing registry
        ExecutionRegistry(registry).authorizeFactory(address(factory));
        console.log("Factory authorized in registry");

        vm.stopBroadcast();
    }
}
