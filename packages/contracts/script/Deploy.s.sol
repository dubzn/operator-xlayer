// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";

contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("VAULT_OWNER");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address trustedRouter = vm.envAddress("TRUSTED_ROUTER");
        address controller = vm.envAddress("CONTROLLER_ADDRESS");
        address tokenIn = vm.envAddress("TOKEN_IN");
        address tokenOut = vm.envAddress("TOKEN_OUT");
        uint256 maxPerTrade = vm.envUint("MAX_PER_TRADE");
        uint256 maxDailyVolume = vm.envUint("MAX_DAILY_VOLUME");
        uint256 maxSlippageBps = vm.envUint("MAX_SLIPPAGE_BPS");
        uint256 cooldownSeconds = vm.envUint("COOLDOWN_SECONDS");

        vm.startBroadcast();

        ExecutionRegistry registry = new ExecutionRegistry();
        console.log("ExecutionRegistry:", address(registry));

        OperatorVault vault = new OperatorVault(
            owner,
            operator,
            trustedRouter,
            maxPerTrade,
            maxDailyVolume,
            maxSlippageBps,
            cooldownSeconds
        );
        console.log("OperatorVault:", address(vault));

        vault.authorizeController(controller);
        vault.addAllowedToken(tokenIn);
        vault.addAllowedToken(tokenOut);

        console.log("Controller authorized:", controller);
        console.log("Tokens allowed:", tokenIn, tokenOut);

        vm.stopBroadcast();
    }
}
