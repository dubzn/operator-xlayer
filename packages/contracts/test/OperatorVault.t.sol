// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OperatorVault} from "../src/OperatorVault.sol";
import {ExecutionRegistry} from "../src/ExecutionRegistry.sol";
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

    uint256 constant MAX_PER_TRADE = 1000e6; // 1000 USDT
    uint256 constant SWAP_AMOUNT = 100e6;    // 100 USDT
    uint256 constant SWAP_OUT = 0.05 ether;  // ~0.05 WETH

    function setUp() public {
        vaultOwner = makeAddr("owner");
        (operator, operatorKey) = makeAddrAndKey("operator");
        (controller, controllerKey) = makeAddrAndKey("controller");
        randomUser = makeAddr("random");

        // Deploy tokens
        usdt = new MockERC20("USDT", "USDT", 6);
        weth = new MockERC20("WETH", "WETH", 18);

        // Deploy DEX and fund it with WETH for swaps
        dex = new MockDEX();
        weth.mint(address(dex), 100 ether);

        // Deploy registry
        registry = new ExecutionRegistry();

        // Deploy vault
        vault = new OperatorVault(
            vaultOwner,
            operator,
            address(dex),
            MAX_PER_TRADE
        );

        // Owner configures vault
        vm.startPrank(vaultOwner);
        vault.authorizeController(controller);
        vault.addAllowedToken(address(usdt));
        vault.addAllowedToken(address(weth));

        // Owner deposits USDT into vault
        usdt.mint(vaultOwner, 5000e6);
        usdt.approve(address(vault), 5000e6);
        vault.deposit(address(usdt), 5000e6);
        vm.stopPrank();
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
        return vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    // --- Tests ---

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
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_unauthorizedController() public {
        uint256 fakeKey = uint256(keccak256("fake"));
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, fakeKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert();
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_reusedNonce() public {
        _executeValidSwap(42);

        OperatorVault.ExecutionIntent memory intent = _buildIntent(42, block.timestamp + 300);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.NonceAlreadyUsed.selector, 42));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_revert_expiredDeadline() public {
        OperatorVault.ExecutionIntent memory intent = _buildIntent(1, block.timestamp - 1);
        bytes memory sig = _signIntent(intent, controllerKey);
        bytes memory routeData = _buildRouteData(SWAP_AMOUNT, SWAP_OUT);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.IntentExpired.selector, block.timestamp - 1));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
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
        vm.expectRevert(abi.encodeWithSelector(OperatorVault.TokenNotAllowed.selector, address(badToken)));
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
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
        vault.executeSwap(intent, routeData, sig, bytes32(uint256(1)), address(registry));
    }

    function test_receiptRecorded() public {
        bytes32 jobId = _executeValidSwap(99);

        ExecutionRegistry.Receipt memory receipt = registry.getReceipt(jobId);
        assertEq(receipt.vault, address(vault));
        assertEq(receipt.controller, controller);
        assertEq(receipt.operator, operator);
        assertEq(receipt.tokenIn, address(usdt));
        assertEq(receipt.tokenOut, address(weth));
        assertEq(receipt.amountIn, SWAP_AMOUNT);
        assertEq(receipt.amountOut, SWAP_OUT);
        assertTrue(receipt.success);
    }
}
