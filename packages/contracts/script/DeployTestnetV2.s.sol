// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {MockRouter} from "../src/MockRouter.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

contract DeployTestnetV2 is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // X Layer testnet tokens
        address usdt = 0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c;
        address usdc = 0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Deploy MockRouter (reuse works too, but fresh is cleaner)
        MockRouter router = new MockRouter();
        console.log("MockRouter:", address(router));

        // 2. Deploy ExecutionRegistry (new version with factory support)
        ExecutionRegistry registry = new ExecutionRegistry();
        console.log("ExecutionRegistry:", address(registry));

        // 3. Deploy VaultFactory
        VaultFactory factory = new VaultFactory(
            address(registry),
            deployer,          // operator
            address(router),   // trustedRouter
            address(0)         // approvalTarget defaults to router
        );
        console.log("VaultFactory:", address(factory));

        // 4. Authorize factory in registry
        registry.authorizeFactory(address(factory));
        console.log("Factory authorized in registry");

        // 5. Create a test vault via the factory
        address vault = factory.createVault(
            usdt,           // baseToken
            5_000_000,      // maxPerTrade: 5 USDT
            10_000_000,     // maxDailyVolume: 10 USDT
            500,            // maxSlippage: 5%
            10              // cooldown: 10s
        );
        console.log("TestVault (via factory):", vault);

        // 6. Configure test vault
        OperatorVault(vault).authorizeController(deployer);
        OperatorVault(vault).addAllowedToken(usdc);

        console.log("--- Config ---");
        console.log("Deployer:", deployer);
        console.log("BaseToken (USDT):", usdt);
        console.log("AllowedOut (USDC):", usdc);

        vm.stopBroadcast();
    }
}
