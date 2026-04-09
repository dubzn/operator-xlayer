// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

contract DeployFactory is Script {
    function run() external {
        // Reuse existing registry and router from testnet deploy
        address registry = 0x22188933120f63Ea6EAd700fFc967bdB0db88A79;
        address operator = 0xF88A50ef4CfCAa82021D6b362530bc0887cB570b;
        address router = 0x652cc79a37Ef6c9CD76179c6238A6C4CC3018493;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        VaultFactory factory = new VaultFactory(registry, operator, router, address(0));
        console.log("VaultFactory:", address(factory));

        vm.stopBroadcast();
    }
}
