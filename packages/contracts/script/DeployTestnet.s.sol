// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {MockRouter} from "../src/MockRouter.sol";
import {OkxAggregatorSwapAdapter} from "../src/OkxAggregatorSwapAdapter.sol";

contract DeployTestnet is Script {
    function run() external {
        // Single wallet acts as owner, operator, and controller for testnet
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // X Layer testnet tokens
        address usdt = 0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c;
        address usdc = 0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D;

        // Policy params for testnet
        uint256 maxPerTrade = 5_000_000;     // 5 USDT
        uint256 maxDailyVolume = 10_000_000; // 10 USDT
        uint256 maxSlippageBps = 500;        // 5%
        uint256 cooldownSeconds = 10;        // 10s for fast testing

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Deploy MockRouter
        MockRouter router = new MockRouter();
        console.log("MockRouter:", address(router));

        // 2. Deploy ExecutionRegistry
        ExecutionRegistry registry = new ExecutionRegistry();
        console.log("ExecutionRegistry:", address(registry));

        // 3. Deploy Mock-backed swap adapter
        OkxAggregatorSwapAdapter adapter = new OkxAggregatorSwapAdapter(address(router), address(router));
        console.log("Mock Swap Adapter:", address(adapter));

        // 4. Deploy OperatorVault
        OperatorVault vault = new OperatorVault(
            deployer,       // owner
            usdt,           // baseToken (USDT)
            deployer,       // operator (same wallet for testnet)
            address(adapter),
            maxPerTrade,
            maxDailyVolume,
            maxSlippageBps,
            cooldownSeconds
        );
        console.log("OperatorVault:", address(vault));

        // 5. Configure
        registry.authorizeVault(address(vault));
        vault.authorizeController(deployer); // controller = deployer for testnet
        vault.addAllowedToken(usdc);         // allow USDT -> USDC swaps
        vault.allowPair(usdt, usdc);

        console.log("--- Config ---");
        console.log("Owner/Operator/Controller:", deployer);
        console.log("BaseToken (USDT):", usdt);
        console.log("AllowedOut (USDC):", usdc);

        vm.stopBroadcast();
    }
}
