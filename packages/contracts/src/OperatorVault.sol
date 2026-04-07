// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IExecutionRegistry} from "./interfaces/IExecutionRegistry.sol";

contract OperatorVault is EIP712 {
    using SafeERC20 for IERC20;

    // --- Types ---

    struct ExecutionIntent {
        address vaultAddress;
        address controller;
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint256 maxSlippageBps;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant EXECUTION_INTENT_TYPEHASH = keccak256(
        "ExecutionIntent(address vaultAddress,address controller,address tokenIn,address tokenOut,uint256 amount,uint256 maxSlippageBps,uint256 nonce,uint256 deadline)"
    );

    // --- State ---

    address public owner;
    address public baseToken;
    address public authorizedOperator;
    address public trustedRouter;
    uint256 public maxAmountPerTrade;
    uint256 public maxDailyVolume;
    uint256 public maxSlippageBps;
    uint256 public cooldownSeconds;
    bool public paused;

    // Volume tracking (UTC day bucket)
    uint256 public currentDay;
    uint256 public dailyVolumeUsed;
    uint256 public lastExecution;

    mapping(address => bool) public authorizedControllers;
    mapping(address => bool) public allowedTokens;
    mapping(uint256 => bool) public usedNonces;

    // --- Events ---

    event Deposit(address indexed token, uint256 amount);
    event Withdraw(address indexed token, uint256 amount, address indexed to);
    event ControllerAuthorized(address indexed controller);
    event ControllerRevoked(address indexed controller);
    event TokenAllowed(address indexed token);
    event TokenRemoved(address indexed token);
    event PolicyUpdated(uint256 maxAmountPerTrade, uint256 maxDailyVolume, uint256 maxSlippageBps, uint256 cooldownSeconds);
    event Paused();
    event Unpaused();
    event ExecutionSucceeded(
        bytes32 indexed jobId,
        address indexed controller,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // --- Errors ---

    error OnlyOwner();
    error OnlyOperator();
    error UnauthorizedController(address controller);
    error ControllerMismatch(address claimedController, address recoveredController);
    error NonceAlreadyUsed(uint256 nonce);
    error IntentExpired(uint256 deadline);
    error TokenNotAllowed(address token);
    error InvalidBaseToken(address tokenIn, address expectedBaseToken);
    error AmountExceedsLimit(uint256 amount, uint256 max);
    error VaultAddressMismatch();
    error SwapFailed();
    error VaultPaused();
    error DailyVolumeExceeded(uint256 used, uint256 max);
    error CooldownNotMet(uint256 lastExec, uint256 cooldown);
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);

    // --- Modifiers ---

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != authorizedOperator) revert OnlyOperator();
        _;
    }

    // --- Constructor ---

    constructor(
        address _owner,
        address _baseToken,
        address _operator,
        address _trustedRouter,
        uint256 _maxAmountPerTrade,
        uint256 _maxDailyVolume,
        uint256 _maxSlippageBps,
        uint256 _cooldownSeconds
    ) EIP712("X402Operator", "1") {
        owner = _owner;
        baseToken = _baseToken;
        authorizedOperator = _operator;
        trustedRouter = _trustedRouter;
        maxAmountPerTrade = _maxAmountPerTrade;
        maxDailyVolume = _maxDailyVolume;
        maxSlippageBps = _maxSlippageBps;
        cooldownSeconds = _cooldownSeconds;
    }

    // --- Owner functions ---

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(token, amount);
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Withdraw(token, amount, to);
    }

    function authorizeController(address controller) external onlyOwner {
        authorizedControllers[controller] = true;
        emit ControllerAuthorized(controller);
    }

    function revokeController(address controller) external onlyOwner {
        authorizedControllers[controller] = false;
        emit ControllerRevoked(controller);
    }

    function addAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = true;
        emit TokenAllowed(token);
    }

    function removeAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function updatePolicy(
        uint256 _maxAmountPerTrade,
        uint256 _maxDailyVolume,
        uint256 _maxSlippageBps,
        uint256 _cooldownSeconds
    ) external onlyOwner {
        maxAmountPerTrade = _maxAmountPerTrade;
        maxDailyVolume = _maxDailyVolume;
        maxSlippageBps = _maxSlippageBps;
        cooldownSeconds = _cooldownSeconds;
        emit PolicyUpdated(_maxAmountPerTrade, _maxDailyVolume, _maxSlippageBps, _cooldownSeconds);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // --- Core execution ---

    function executeSwap(
        ExecutionIntent calldata intent,
        bytes calldata routeData,
        bytes calldata signature,
        bytes32 paymentRef,
        address registry,
        uint256 minAmountOut
    ) external onlyOperator returns (bytes32 jobId) {
        // 0. Pause check
        if (paused) revert VaultPaused();

        // 1. Verify vault address matches
        if (intent.vaultAddress != address(this)) revert VaultAddressMismatch();

        // 2. Verify and recover controller from EIP-712 signature
        bytes32 structHash = _hashIntent(intent);
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredController = ECDSA.recover(digest, signature);

        if (intent.controller != recoveredController) {
            revert ControllerMismatch(intent.controller, recoveredController);
        }

        if (!authorizedControllers[recoveredController]) {
            revert UnauthorizedController(recoveredController);
        }

        // 3. Nonce check
        if (usedNonces[intent.nonce]) revert NonceAlreadyUsed(intent.nonce);
        usedNonces[intent.nonce] = true;

        // 4. Deadline check
        if (block.timestamp > intent.deadline) revert IntentExpired(intent.deadline);

        // 5. Token allowlist check
        if (intent.tokenIn != baseToken) revert InvalidBaseToken(intent.tokenIn, baseToken);
        if (!allowedTokens[intent.tokenOut]) revert TokenNotAllowed(intent.tokenOut);

        // 6. Amount limit check
        if (intent.amount > maxAmountPerTrade) {
            revert AmountExceedsLimit(intent.amount, maxAmountPerTrade);
        }

        // 7. Daily volume check (UTC day bucket)
        uint256 today = block.timestamp / 86400;
        if (today != currentDay) {
            currentDay = today;
            dailyVolumeUsed = 0;
        }
        if (maxDailyVolume > 0 && dailyVolumeUsed + intent.amount > maxDailyVolume) {
            revert DailyVolumeExceeded(dailyVolumeUsed + intent.amount, maxDailyVolume);
        }

        // 8. Cooldown check (skip on first execution)
        if (cooldownSeconds > 0 && lastExecution > 0 && block.timestamp < lastExecution + cooldownSeconds) {
            revert CooldownNotMet(lastExecution, cooldownSeconds);
        }

        // --- Execute swap through trusted router ---
        uint256 balanceBefore = IERC20(intent.tokenOut).balanceOf(address(this));

        IERC20(intent.tokenIn).approve(trustedRouter, intent.amount);
        (bool success,) = trustedRouter.call(routeData);
        if (!success) revert SwapFailed();

        uint256 amountOut = IERC20(intent.tokenOut).balanceOf(address(this)) - balanceBefore;

        // 9. Slippage check — effective slippage = min(policy, intent)
        if (minAmountOut > 0 && amountOut < minAmountOut) {
            revert SlippageExceeded(amountOut, minAmountOut);
        }

        // Update volume and cooldown tracking
        dailyVolumeUsed += intent.amount;
        lastExecution = block.timestamp;

        // --- Compute jobId and emit ---
        bytes32 intentHash = _hashTypedDataV4(structHash);
        jobId = keccak256(abi.encodePacked(intentHash, paymentRef));

        emit ExecutionSucceeded(
            jobId,
            recoveredController,
            intent.tokenIn,
            intent.tokenOut,
            intent.amount,
            amountOut
        );

        // --- Record receipt in registry ---
        if (registry != address(0)) {
            IExecutionRegistry(registry).recordReceipt(
                IExecutionRegistry.Receipt({
                    jobId: jobId,
                    vault: address(this),
                    controller: recoveredController,
                    operator: msg.sender,
                    paymentRef: paymentRef,
                    tokenIn: intent.tokenIn,
                    tokenOut: intent.tokenOut,
                    amountIn: intent.amount,
                    amountOut: amountOut,
                    timestamp: block.timestamp,
                    success: true
                })
            );
        }
    }

    // --- Internal ---

    function _hashIntent(ExecutionIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            EXECUTION_INTENT_TYPEHASH,
            intent.vaultAddress,
            intent.controller,
            intent.tokenIn,
            intent.tokenOut,
            intent.amount,
            intent.maxSlippageBps,
            intent.nonce,
            intent.deadline
        ));
    }

    // --- View helpers ---

    function getIntentHash(ExecutionIntent calldata intent) external view returns (bytes32) {
        return _hashTypedDataV4(_hashIntent(intent));
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
