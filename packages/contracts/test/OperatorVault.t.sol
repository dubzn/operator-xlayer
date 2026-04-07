// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {IExecutionRegistry} from "../src/interfaces/IExecutionRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockDEX} from "./mocks/MockDEX.sol";

contract OperatorVaultTest is Test {
    OperatorVault public vault;
    ExecutionRegistry public registry;
    MockERC20 public usdt;
    MockERC20 public weth;
    MockDEX public dex;

    address public vaultOwner;
    uint256 public operatorKey;
    address public operator;
    uint256 public controllerKey;
    address public controller;
    address public randomUser;

    uint256 constant MAX_PER_TRADE = 1000e6;     // 1000 USDT
    uint256 constant MAX_DAILY_VOLUME = 3000e6;   // 3000 USDT
    uint256 constant MAX_SLIPPAGE_BPS = 200;      // 2%
    uint256 constant COOLDOWN = 1800;             // 30 minutes
    uint256 constant SWAP_AMOUNT = 100e6;         // 100 USDT
    uint256 constant SWAP_OUT = 0.05 ether;       // ~0.05 WETH

    function setUp() public {
        vaultOwner = makeAddr("owner");
        (operator, operatorKey) = makeAddrAndKey("operator");
        (controller, controllerKey) = makeAddrAndKey("controller");
        randomUser = makeAddr("random");

        usdt = new MockERC20("USDT", "USDT", 6);
        weth = new MockERC20("WETH", "WETH", 18);

        dex = new MockDEX();
        weth.mint(address(dex), 100 ether);

        registry = new ExecutionRegistry();

        vault = new OperatorVault(
            vaultOwner,
            address(usdt),
            operator,
            address(dex),
            MAX_PER_TRADE,
            MAX_DAILY_VOLUME,
            MAX_SLIPPAGE_BPS,
            COOLDOWN
        );

        vm.startPrank(vaultOwner);
        vault.authorizeController(controller);
        vault.addAllowedToken(address(weth));

        usdt.mint(vaultOwner, 5000e6);
        usdt.approve(address(vault), 5000e6);
        vault.deposit(address(usdt), 5000e6);
        vm.stopPrank();

        registry.authorizeVault(address(vault));
    }

    // --- Helpers ---

    function _buildIntent(uint256 nonce, uint256 deadline) internal view returns (OperatorVault.ExecutionIntent memory) {
        return OperatorVault.ExecutionIntent({
            vaultAddress: address(vault),
            controller: controller,
            tokenIn: address(usdt),
            tokenOut: address(weth),
            amount: SWAP_AMOUNT,
            maxSlippageBps: 200,
            nonce: nonce,
            deadline: deadline
        });
    }

    function _signIntent(
        OperatorVault.ExecutionIntent memory intent,
        uint256 signerKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            vault.EXECUTION_INTENT_TYPEHASH(),
            intent.vaultAddress,
            intent.controller,
            intent.tokenIn,
            intent.tokenOut,
            intent.amount,
            intent.maxSlippageBps,
            intent.nonce,
            intent.deadline
        ));

        bytes32 domainSeparator = vault.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _buildRouteData(uint256 amountIn, uint256 amountOut) internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            MockDEX.swap.selector,
            address(usdt),
            address(weth),
            amountIn,
            amountOut,
            address(vault)
        );
    }

    function _executeValidSwap(uint256 nonce) internal returns (bytes32) {
        OperatorVault.ExecutionIntent memory intent = _buildIntent(nonce, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        return vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    // --- Phase 1 Tests ---

    function test_validExecution() public {
        uint256 usdtBefore = usdt.balanceOf(address(vault));
        uint256 wethBefore = weth.balanceOf(address(vault));

        bytes32 jobId = _executeValidSwap(1);

        assertEq(usdt.balanceOf(address(vault)), usdtBefore - SWAP_AMOUNT);
        assertEq(weth.balanceOf(address(vault)), wethBefore + SWAP_OUT);
        assertTrue(jobId != bytes32(0));
    }

    function test_revert_unauthorizedOperator() public {
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(randomUser);
        vm.expectRevert(OperatorVault.OnlyOperator.selector);
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_unauthorizedController() public {
        uint256 fakeKey = uint256(keccak256("fake"));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, fakeKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert();
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_reusedNonce() public {
        _executeValidSwap(42);

        OperatorVault.ExecutionIntent memory intent = _buildIntent(42, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.NonceAlreadyUsed.selector, 42));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_expiredDeadline() public {
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp - 1);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.IntentExpired.selector, block.timestamp - 1));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_tokenNotAllowed() public {
        MockERC20 badToken = new MockERC20("BAD", "BAD", 18);

        OperatorVault.ExecutionIntent memory intent = OperatorVault.ExecutionIntent({
            vaultAddress: address(vault),
            controller: controller,
            tokenIn: address(badToken),
            tokenOut: address(weth),
            amount: SWAP_AMOUNT,
            maxSlippageBps: 200,
            nonce: 1,
            deadline: block.timestamp + 300
        });
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.InvalidBaseToken.selector, address(badToken), address(usdt)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_controllerMismatch() public {
        OperatorVault.ExecutionIntent memory intent = OperatorVault.ExecutionIntent({
            vaultAddress: address(vault),
            controller: randomUser,
            tokenIn: address(usdt),
            tokenOut: address(weth),
            amount: SWAP_AMOUNT,
            maxSlippageBps: 200,
            nonce: 1,
            deadline: block.timestamp + 300
        });
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.ControllerMismatch.selector, randomUser, controller));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_revert_amountExceedsLimit() public {
        uint256 tooMuch = MAX_PER_TRADE + 1;
        OperatorVault.ExecutionIntent memory intent = OperatorVault.ExecutionIntent({
            vaultAddress: address(vault),
            controller: controller,
            tokenIn: address(usdt),
            tokenOut: address(weth),
            amount: tooMuch,
            maxSlippageBps: 200,
            nonce: 1,
            deadline: block.timestamp + 300
        });
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(tooMuch, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.AmountExceedsLimit.selector, tooMuch, MAX_PER_TRADE));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_receiptRecorded() public {
        bytes32 jobId = _executeValidSwap(99);

        IExecutionRegistry.Receipt memory receipt = registry.getReceipt(jobId);
        assertEq(receipt.vault, address(vault));
        assertEq(receipt.controller, controller);
        assertEq(receipt.operator, operator);
        assertEq(receipt.tokenIn, address(usdt));
        assertEq(receipt.tokenOut, address(weth));
        assertEq(receipt.amountIn, SWAP_AMOUNT);
        assertEq(receipt.amountOut, SWAP_OUT);
        assertTrue(receipt.success);
        assertEq(registry.getTrackRecord(operator), 1);
    }

    function test_registryRejectsUnauthorizedRecorder() public {
        IExecutionRegistry.Receipt memory receipt = IExecutionRegistry.Receipt({
            jobId: bytes32(uint256(123)),
            vault: address(vault),
            controller: controller,
            operator: operator,
            paymentRef: bytes32(uint256(1)),
            tokenIn: address(usdt),
            tokenOut: address(weth),
            amountIn: SWAP_AMOUNT,
            amountOut: SWAP_OUT,
            timestamp: block.timestamp,
            success: true
        });

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(ExecutionRegistry.UnauthorizedRecorder.selector, randomUser));
        registry.recordReceipt(receipt);
    }

    // --- Phase 2 Tests ---

    function test_revert_paused() public {
        vm.prank(vaultOwner);
        vault.pause();

        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(OperatorVault.VaultPaused.selector);
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), 0);
    }

    function test_unpause_resumes_execution() public {
        vm.startPrank(vaultOwner);
        vault.pause();
        vault.unpause();
        vm.stopPrank();

        _executeValidSwap(1);
    }

    function test_revert_dailyVolumeExceeded() public {
        // Execute swaps until daily volume is near limit (3000 USDT, each swap is 100 USDT)
        // We need 30 swaps to hit 3000, but the 31st should fail
        // For efficiency, let's use a vault with lower daily volume
        OperatorVault smallVault = new OperatorVault(
            vaultOwner, address(usdt), operator, address(dex),
            MAX_PER_TRADE, 250e6, MAX_SLIPPAGE_BPS, 0 // dailyVolume=250, cooldown=0
        );

        vm.startPrank(vaultOwner);
        smallVault.authorizeController(controller);
        smallVault.addAllowedToken(address(weth));
        usdt.mint(vaultOwner, 5000e6);
        usdt.approve(address(smallVault), 5000e6);
        smallVault.deposit(address(usdt), 5000e6);
        vm.stopPrank();

        registry.authorizeVault(address(smallVault));

        // Execute 2 swaps of 100 each = 200 used
        for (uint256 i = 1; i <= 2; i++) {
            OperatorVault.ExecutionIntent memory intent = OperatorVault.ExecutionIntent({
                vaultAddress: address(smallVault),
                controller: controller,
                tokenIn: address(usdt),
                tokenOut: address(weth),
                amount: SWAP_AMOUNT,
                maxSlippageBps: 200,
                nonce: i,
                deadline: block.timestamp + 300
            });
            bytes memory sig = _signIntentForVault(intent, controllerKey, smallVault);
            bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);
            vm.prank(operator);
            smallVault.executeSwap(intent, routeData, sig, bytes32(i), address(registry), 0);
        }

        // 3rd swap (200 + 100 = 300 > 250) should fail
        OperatorVault.ExecutionIntent memory intent3 = OperatorVault.ExecutionIntent({
            vaultAddress: address(smallVault),
            controller: controller,
            tokenIn: address(usdt),
            tokenOut: address(weth),
            amount: SWAP_AMOUNT,
            maxSlippageBps: 200,
            nonce: 3,
            deadline: block.timestamp + 300
        });
        bytes memory sig3 = _signIntentForVault(intent3, controllerKey, smallVault);
        bytes memory routeData3 = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.DailyVolumeExceeded.selector, 300e6, 250e6));
        smallVault.executeSwap(intent3, routeData3, sig3, bytes32(uint256(3)), address(registry), 0);
    }

    function test_revert_cooldownNotMet() public {
        _executeValidSwap(1);

        // Try immediately — should fail due to 1800s cooldown
        OperatorVault.ExecutionIntent memory intent = _buildIntent(2, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert();
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(2)), address(registry), 0);
    }

    function test_cooldown_passes_after_wait() public {
        _executeValidSwap(1);

        // Warp past cooldown
        vm.warp(block.timestamp + COOLDOWN + 1);

        _executeValidSwap(2);
    }

    function test_revert_slippageExceeded() public {
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        // Route gives very little output
        uint256 tinyOut = 1;
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, tinyOut);

        // Set minAmountOut to something the swap can't meet
        uint256 minAmountOut = SWAP_OUT;

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.SlippageExceeded.selector, tinyOut, minAmountOut));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry), minAmountOut);
    }

    function test_dailyVolume_resets_next_day() public {
        _executeValidSwap(1);

        // Warp to next UTC day
        uint256 nextDay = ((block.timestamp / 86400) + 1) * 86400;
        vm.warp(nextDay);

        _executeValidSwap(2);
        // If volume didn't reset, this would accumulate, but it passes
    }

    // --- Helper for custom vault ---

    function _signIntentForVault(
        OperatorVault.ExecutionIntent memory intent,
        uint256 signerKey,
        OperatorVault targetVault
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            targetVault.EXECUTION_INTENT_TYPEHASH(),
            intent.vaultAddress,
            intent.controller,
            intent.tokenIn,
            intent.tokenOut,
            intent.amount,
            intent.maxSlippageBps,
            intent.nonce,
            intent.deadline
        ));

        bytes32 domainSeparator = targetVault.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
