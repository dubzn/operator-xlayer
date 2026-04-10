// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {OkxAggregatorSwapAdapter} from "../src/OkxAggregatorSwapAdapter.sol";

contract DeployFactory is Script {
    function run() external {
        // Reuse existing registry and OKX router addresses
        address registry = 0x22188933120f63Ea6EAd700fFc967bdB0db88A79;
        address operator = 0xF88A50ef4CfCAa82021D6b362530bc0887cB570b;
        address router = 0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954;
        address approvalTarget = 0x8b773D83bc66Be128c60e07E17C8901f7a64F000;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        OkxAggregatorSwapAdapter adapter = new OkxAggregatorSwapAdapter(router, approvalTarget);
        console.log("OKX Adapter:", address(adapter));

        VaultFactory factory = new VaultFactory(registry, operator, address(adapter));
        console.log("VaultFactory:", address(factory));

        vm.stopBroadcast();
    }
}
