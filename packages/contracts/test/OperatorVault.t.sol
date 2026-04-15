// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
import {IExecutionRegistry} from "../src/interfaces/IExecutionRegistry.sol";
import {OkxAggregatorSwapAdapter} from "../src/OkxAggregatorSwapAdapter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockDEX} from "./mocks/MockDEX.sol";

contract OperatorVaultTest is Test {
    OperatorVault public vault;
    ExecutionRegistry public registry;
    OkxAggregatorSwapAdapter public adapter;
    MockERC20 public usdt;
    MockERC20 public weth;
    MockDEX public dex;

    address public vaultOwner;
    uint256 public operatorKey;
    address public operator;
    uint256 public controllerKey;
    address public controller;
    uint256 public unauthorizedControllerKey;
    address public unauthorizedController;
    address public randomUser;

    uint256 constant MAX_PER_TRADE = 1000e6;
    uint256 constant MAX_DAILY_VOLUME = 3000e6;
    uint256 constant MAX_SLIPPAGE_BPS = 200;
    uint256 constant COOLDOWN = 1800;
    uint256 constant SWAP_AMOUNT = 100e6;
    uint256 constant SWAP_OUT = 0.05 ether;

    function setUp() public {
        vaultOwner = makeAddr("owner");
        (operator, operatorKey) = makeAddrAndKey("operator");
        (controller, controllerKey) = makeAddrAndKey("controller");
        (unauthorizedController, unauthorizedControllerKey) = makeAddrAndKey("unauthorized-controller");
        randomUser = makeAddr("random");

        usdt = new MockERC20("USDT", "USDT", 6);
        weth = new MockERC20("WETH", "WETH", 18);

        dex = new MockDEX();
        weth.mint(address(dex), 100 ether);

        adapter = new OkxAggregatorSwapAdapter(address(dex), address(dex));
        registry = new ExecutionRegistry();

        vault = new OperatorVault(
            vaultOwner,
            address(usdt),
            operator,
            address(adapter),
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

    function _policyMinAmountOut(uint256 quotedAmountOut) internal pure returns (uint256) {
        return (quotedAmountOut * (10_000 - MAX_SLIPPAGE_BPS)) / 10_000;
    }

    function _buildRouteData(uint256 amountIn, uint256 amountOut, address recipient) internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            MockDEX.swap.selector,
            address(usdt),
            address(weth),
            amountIn,
            amountOut,
            recipient
        );
    }

    function _buildIntent(
        OperatorVault targetVault,
        address intentController,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 quotedAmountOut,
        uint256 minAmountOut,
        uint256 nonce,
        uint256 deadline,
        bytes memory executionData
    ) internal view returns (OperatorVault.ExecutionIntent memory) {
        return OperatorVault.ExecutionIntent({
            vaultAddress: address(targetVault),
            controller: intentController,
            adapter: address(adapter),
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            quotedAmountOut: quotedAmountOut,
            minAmountOut: minAmountOut,
            nonce: nonce,
            deadline: deadline,
            executionHash: keccak256(executionData)
        });
    }

    function _signIntent(
        OperatorVault.ExecutionIntent memory intent,
        uint256 signerKey,
        OperatorVault targetVault
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                targetVault.EXECUTION_INTENT_TYPEHASH(),
                intent.vaultAddress,
                intent.controller,
                intent.adapter,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.quotedAmountOut,
                intent.minAmountOut,
                intent.nonce,
                intent.deadline,
                intent.executionHash
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", targetVault.DOMAIN_SEPARATOR(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _executeValidSwap(uint256 nonce) internal returns (bytes32) {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            nonce,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        return vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_enumerableViewsExposeInitialConfiguration() public view {
        address[] memory controllers = vault.getAuthorizedControllers();
        address[] memory inputTokens = vault.getAllowedInputTokens();
        address[] memory outputTokens = vault.getAllowedTokens();

        assertEq(controllers.length, 1);
        assertEq(controllers[0], controller);

        assertEq(inputTokens.length, 1);
        assertEq(inputTokens[0], address(usdt));

        assertEq(outputTokens.length, 1);
        assertEq(outputTokens[0], address(weth));

        assertEq(vault.nextNonce(), 0);
    }

    function test_enumerableViewsUpdateOnRemoval() public {
        vm.startPrank(vaultOwner);
        vault.revokeController(controller);
        vault.removeAllowedInputToken(address(usdt));
        vault.removeAllowedToken(address(weth));
        vm.stopPrank();

        assertEq(vault.getAuthorizedControllers().length, 0);
        assertEq(vault.getAllowedInputTokens().length, 0);
        assertEq(vault.getAllowedTokens().length, 0);
    }

    function test_validExecution() public {
        uint256 usdtBefore = usdt.balanceOf(address(vault));
        uint256 wethBefore = weth.balanceOf(address(vault));

        bytes32 jobId = _executeValidSwap(1);

        assertEq(usdt.balanceOf(address(vault)), usdtBefore - SWAP_AMOUNT);
        assertEq(weth.balanceOf(address(vault)), wethBefore + SWAP_OUT);
        assertTrue(jobId != bytes32(0));
    }

    function test_nextNonceTracksHighestConsumedNonce() public {
        _executeValidSwap(42);
        assertEq(vault.nextNonce(), 43);

        vm.warp(vault.lastExecution() + COOLDOWN + 1);
        _executeValidSwap(7);
        assertEq(vault.nextNonce(), 43);

        vm.warp(vault.lastExecution() + COOLDOWN + 1);
        _executeValidSwap(99);
        assertEq(vault.nextNonce(), 100);
    }

    function test_revert_unauthorizedOperator() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(randomUser);
        vm.expectRevert(OperatorVault.OnlyOperator.selector);
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_unauthorizedController() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            unauthorizedController,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, unauthorizedControllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.UnauthorizedController.selector, unauthorizedController));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_reusedNonce() public {
        _executeValidSwap(42);

        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            42,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.NonceAlreadyUsed.selector, 42));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(2)), address(registry));
    }

    function test_revert_expiredDeadline() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp - 1,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.IntentExpired.selector, block.timestamp - 1));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_inputTokenNotAllowed() public {
        MockERC20 badToken = new MockERC20("BAD", "BAD", 18);
        bytes memory routeData = abi.encodeWithSelector(
            MockDEX.swap.selector,
            address(badToken),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            address(vault)
        );

        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(badToken),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.InputTokenNotAllowed.selector, address(badToken)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_tokenNotAllowed() public {
        MockERC20 badOut = new MockERC20("BAD", "BAD", 18);
        bytes memory routeData = abi.encodeWithSelector(
            MockDEX.swap.selector,
            address(usdt),
            address(badOut),
            SWAP_AMOUNT,
            SWAP_OUT,
            address(vault)
        );

        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(badOut),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.TokenNotAllowed.selector, address(badOut)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_pairAllowlistIsNotRequiredForExecution() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_adapterNotAllowed() public {
        vm.prank(vaultOwner);
        vault.revokeSwapAdapter(address(adapter));

        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.SwapAdapterNotAllowed.selector, address(adapter)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_controllerMismatch() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            randomUser,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.ControllerMismatch.selector, randomUser, controller));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_amountExceedsLimit() public {
        uint256 tooMuch = MAX_PER_TRADE + 1;
        bytes memory routeData = _buildRouteData(tooMuch, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            tooMuch,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.AmountExceedsLimit.selector, tooMuch, MAX_PER_TRADE));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_executionHashMismatch() public {
        bytes memory previewRouteData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        bytes memory actualRouteData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT - 1, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            previewRouteData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.ExecutionHashMismatch.selector, keccak256(previewRouteData), keccak256(actualRouteData)));
        vault.executeSwap(intent, actualRouteData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_minAmountOutBelowPolicy() public {
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        uint256 belowPolicy = _policyMinAmountOut(SWAP_OUT) - 1;
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            belowPolicy,
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.MinAmountOutBelowPolicy.selector, belowPolicy, _policyMinAmountOut(SWAP_OUT)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_receiptRecorded() public {
        bytes32 jobId = _executeValidSwap(99);

        IExecutionRegistry.Receipt memory receipt = registry.getReceipt(jobId);
        assertEq(receipt.vault, address(vault));
        assertEq(receipt.controller, controller);
        assertEq(receipt.operator, operator);
        assertEq(receipt.adapter, address(adapter));
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
            adapter: address(adapter),
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

    function test_revert_paused() public {
        vm.prank(vaultOwner);
        vault.pause();

        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(OperatorVault.VaultPaused.selector);
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_unpause_resumes_execution() public {
        vm.startPrank(vaultOwner);
        vault.pause();
        vault.unpause();
        vm.stopPrank();

        _executeValidSwap(1);
    }

    function test_revert_dailyVolumeExceeded() public {
        OperatorVault smallVault = new OperatorVault(
            vaultOwner,
            address(usdt),
            operator,
            address(adapter),
            MAX_PER_TRADE,
            250e6,
            MAX_SLIPPAGE_BPS,
            0
        );

        vm.startPrank(vaultOwner);
        smallVault.authorizeController(controller);
        smallVault.addAllowedToken(address(weth));
        usdt.mint(vaultOwner, 5000e6);
        usdt.approve(address(smallVault), 5000e6);
        smallVault.deposit(address(usdt), 5000e6);
        vm.stopPrank();

        registry.authorizeVault(address(smallVault));

        for (uint256 i = 1; i <= 2; i++) {
            bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(smallVault));
            OperatorVault.ExecutionIntent memory intent = _buildIntent(
                smallVault,
                controller,
                address(usdt),
                address(weth),
                SWAP_AMOUNT,
                SWAP_OUT,
                _policyMinAmountOut(SWAP_OUT),
                i,
                block.timestamp + 300,
                routeData
            );
            bytes memory sig = _signIntent(intent, controllerKey, smallVault);
            vm.prank(operator);
            smallVault.executeSwap(intent, routeData, sig, bytes32(i), address(registry));
        }

        bytes memory routeData3 = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(smallVault));
        OperatorVault.ExecutionIntent memory intent3 = _buildIntent(
            smallVault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            3,
            block.timestamp + 300,
            routeData3
        );
        bytes memory sig3 = _signIntent(intent3, controllerKey, smallVault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.DailyVolumeExceeded.selector, 300e6, 250e6));
        smallVault.executeSwap(intent3, routeData3, sig3, bytes32(uint256(3)), address(registry));
    }

    function test_revert_cooldownNotMet() public {
        _executeValidSwap(1);

        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            2,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.CooldownNotMet.selector, block.timestamp, COOLDOWN));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(2)), address(registry));
    }

    function test_cooldown_passes_after_wait() public {
        _executeValidSwap(1);
        vm.warp(block.timestamp + COOLDOWN + 1);
        _executeValidSwap(2);
    }

    function test_revert_slippageExceeded() public {
        uint256 tinyOut = 1;
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, tinyOut, address(vault));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(
            vault,
            controller,
            address(usdt),
            address(weth),
            SWAP_AMOUNT,
            SWAP_OUT,
            _policyMinAmountOut(SWAP_OUT),
            1,
            block.timestamp + 300,
            routeData
        );
        bytes memory sig = _signIntent(intent, controllerKey, vault);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.SlippageExceeded.selector, tinyOut, _policyMinAmountOut(SWAP_OUT)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_dailyVolume_resets_nextDay() public {
        _executeValidSwap(1);

        uint256 nextDay = ((block.timestamp / 86400) + 1) * 86400;
        vm.warp(nextDay);

        _executeValidSwap(2);
    }
}
