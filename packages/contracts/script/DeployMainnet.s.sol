// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

contract DeployMainnet is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // X Layer mainnet tokens
        address usdt = 0x1E4a5963aBFD975d8c9021ce480b42188849D41d;  // USDC on X Layer mainnet
        // Note: verify token addresses on the X Layer explorer before deploying

        // OKX DEX router on X Layer mainnet
        address okxDexRouter = 0xbec6d0E341102732e4FD62EC50E2F0a9D1bd1D33;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Deploy ExecutionRegistry
        ExecutionRegistry registry = new ExecutionRegistry();
        console.log("ExecutionRegistry:", address(registry));

        // 2. Deploy VaultFactory with OKX DEX router as trusted router
        VaultFactory factory = new VaultFactory(
            address(registry),
            deployer,          // operator
            okxDexRouter       // trustedRouter = OKX DEX router
        );
        console.log("VaultFactory:", address(factory));

        // 3. Authorize factory in registry
        registry.authorizeFactory(address(factory));
        console.log("Factory authorized in registry");

        // 4. Create initial vault via factory
        address vault = factory.createVault(
            usdt,             // baseToken
            50_000_000,       // maxPerTrade: 50 USDT
            200_000_000,      // maxDailyVolume: 200 USDT
            300,              // maxSlippage: 3%
            30                // cooldown: 30s
        );
        console.log("Vault (via factory):", vault);

        console.log("--- Deployment Summary ---");
        console.log("Deployer/Operator:", deployer);
        console.log("OKX DEX Router:", okxDexRouter);
        console.log("BaseToken:", usdt);

        vm.stopBroadcast();
    }
}
