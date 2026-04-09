// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

contract DeployMainnet is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // X Layer mainnet tokens (verified)
        address usdt = 0x1E4a5963aBFD975d8c9021ce480b42188849D41d;
        address usdc = 0x74b7F16337b8972027F6196A17a631aC6dE26d22;

        // OKX DEX aggregation proxy on X Layer mainnet
        address okxDexRouter = 0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954;
        // OKX DEX token approval contract (separate from router)
        address okxApprovalTarget = 0x8b773D83bc66Be128c60e07E17C8901f7a64F000;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Deploy ExecutionRegistry
        ExecutionRegistry registry = new ExecutionRegistry();
        console.log("ExecutionRegistry:", address(registry));

        // 2. Deploy VaultFactory with OKX DEX router as trusted router
        VaultFactory factory = new VaultFactory(
            address(registry),
            deployer,          // operator
            okxDexRouter,      // trustedRouter = OKX DEX aggregation proxy
            okxApprovalTarget  // OKX DEX token approval contract
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

        // 5. Configure vault — allow USDC as output token
        OperatorVault(vault).addAllowedToken(usdc);
        OperatorVault(vault).authorizeController(deployer);

        console.log("--- Deployment Summary ---");
        console.log("Deployer/Operator:", deployer);
        console.log("OKX DEX Router:", okxDexRouter);
        console.log("USDT:", usdt);
        console.log("USDC:", usdc);

        vm.stopBroadcast();
    }
}
