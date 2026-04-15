// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IExecutionRegistry} from "./interfaces/IExecutionRegistry.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

contract OperatorVault is EIP712 {
    using SafeERC20 for IERC20;

    struct ExecutionIntent {
        address vaultAddress;
        address controller;
        address adapter;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 quotedAmountOut;
        uint256 minAmountOut;
        uint256 nonce;
        uint256 deadline;
        bytes32 executionHash;
    }

    bytes32 public constant EXECUTION_INTENT_TYPEHASH = keccak256(
        "ExecutionIntent(address vaultAddress,address controller,address adapter,address tokenIn,address tokenOut,uint256 amountIn,uint256 quotedAmountOut,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes32 executionHash)"
    );

    address public owner;
    address public baseToken;
    address public authorizedOperator;
    uint256 public maxAmountPerTrade;
    uint256 public maxDailyVolume;
    uint256 public maxSlippageBps;
    uint256 public cooldownSeconds;
    bool public paused;

    uint256 public currentDay;
    uint256 public dailyVolumeUsed;
    uint256 public lastExecution;
    uint256 public nextNonce;

    mapping(address => bool) public authorizedControllers;
    mapping(address => bool) public allowedInputTokens;
    mapping(address => bool) public allowedTokens;
    mapping(address => mapping(address => bool)) public allowedPairs;
    mapping(address => bool) public allowedSwapAdapters;
    mapping(uint256 => bool) public usedNonces;

    address[] private authorizedControllerList;
    mapping(address => uint256) private authorizedControllerIndex;
    address[] private allowedInputTokenList;
    mapping(address => uint256) private allowedInputTokenIndex;
    address[] private allowedTokenList;
    mapping(address => uint256) private allowedTokenIndex;

    event Deposit(address indexed token, uint256 amount);
    event Withdraw(address indexed token, uint256 amount, address indexed to);
    event ControllerAuthorized(address indexed controller);
    event ControllerRevoked(address indexed controller);
    event InputTokenAllowed(address indexed token);
    event InputTokenRemoved(address indexed token);
    event TokenAllowed(address indexed token);
    event TokenRemoved(address indexed token);
    event PairAllowed(address indexed tokenIn, address indexed tokenOut);
    event PairRemoved(address indexed tokenIn, address indexed tokenOut);
    event SwapAdapterAllowed(address indexed adapter);
    event SwapAdapterRevoked(address indexed adapter);
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

    error OnlyOwner();
    error OnlyOperator();
    error UnauthorizedController(address controller);
    error ControllerMismatch(address claimedController, address recoveredController);
    error NonceAlreadyUsed(uint256 nonce);
    error IntentExpired(uint256 deadline);
    error InputTokenNotAllowed(address token);
    error TokenNotAllowed(address token);
    error SwapAdapterNotAllowed(address adapter);
    error AmountExceedsLimit(uint256 amount, uint256 max);
    error VaultAddressMismatch();
    error ExecutionHashMismatch(bytes32 expectedHash, bytes32 actualHash);
    error VaultPaused();
    error DailyVolumeExceeded(uint256 used, uint256 max);
    error CooldownNotMet(uint256 lastExec, uint256 cooldown);
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);
    error MinAmountOutBelowPolicy(uint256 minAmountOut, uint256 policyMinimum);
    error AdapterExecutionFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != authorizedOperator) revert OnlyOperator();
        _;
    }

    constructor(
        address _owner,
        address _baseToken,
        address _operator,
        address _defaultSwapAdapter,
        uint256 _maxAmountPerTrade,
        uint256 _maxDailyVolume,
        uint256 _maxSlippageBps,
        uint256 _cooldownSeconds
    ) EIP712("X402Operator", "2") {
        owner = _owner;
        baseToken = _baseToken;
        authorizedOperator = _operator;
        maxAmountPerTrade = _maxAmountPerTrade;
        maxDailyVolume = _maxDailyVolume;
        maxSlippageBps = _maxSlippageBps;
        cooldownSeconds = _cooldownSeconds;

        _setAllowedInputToken(_baseToken, true);
        emit InputTokenAllowed(_baseToken);

        if (_defaultSwapAdapter != address(0)) {
            allowedSwapAdapters[_defaultSwapAdapter] = true;
            emit SwapAdapterAllowed(_defaultSwapAdapter);
        }
    }

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(token, amount);
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Withdraw(token, amount, to);
    }

    function authorizeController(address controller) external onlyOwner {
        _setAuthorizedController(controller, true);
        emit ControllerAuthorized(controller);
    }

    function revokeController(address controller) external onlyOwner {
        _setAuthorizedController(controller, false);
        emit ControllerRevoked(controller);
    }

    function addAllowedInputToken(address token) external onlyOwner {
        _setAllowedInputToken(token, true);
        emit InputTokenAllowed(token);
    }

    function removeAllowedInputToken(address token) external onlyOwner {
        _setAllowedInputToken(token, false);
        emit InputTokenRemoved(token);
    }

    function addAllowedToken(address token) external onlyOwner {
        _setAllowedToken(token, true);
        emit TokenAllowed(token);
    }

    function removeAllowedToken(address token) external onlyOwner {
        _setAllowedToken(token, false);
        emit TokenRemoved(token);
    }

    function getAuthorizedControllers() external view returns (address[] memory) {
        return authorizedControllerList;
    }

    function getAllowedInputTokens() external view returns (address[] memory) {
        return allowedInputTokenList;
    }

    function getAllowedTokens() external view returns (address[] memory) {
        return allowedTokenList;
    }

    function allowPair(address tokenIn, address tokenOut) external onlyOwner {
        allowedPairs[tokenIn][tokenOut] = true;
        emit PairAllowed(tokenIn, tokenOut);
    }

    function revokePair(address tokenIn, address tokenOut) external onlyOwner {
        allowedPairs[tokenIn][tokenOut] = false;
        emit PairRemoved(tokenIn, tokenOut);
    }

    function allowSwapAdapter(address adapter) external onlyOwner {
        allowedSwapAdapters[adapter] = true;
        emit SwapAdapterAllowed(adapter);
    }

    function revokeSwapAdapter(address adapter) external onlyOwner {
        allowedSwapAdapters[adapter] = false;
        emit SwapAdapterRevoked(adapter);
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

    function executeSwap(
        ExecutionIntent calldata intent,
        bytes calldata executionData,
        bytes calldata signature,
        bytes32 paymentRef,
        address registry
    ) external onlyOperator returns (bytes32 jobId) {
        if (paused) revert VaultPaused();
        if (intent.vaultAddress != address(this)) revert VaultAddressMismatch();
        if (!allowedSwapAdapters[intent.adapter]) revert SwapAdapterNotAllowed(intent.adapter);

        bytes32 structHash = _hashIntent(intent);
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredController = ECDSA.recover(digest, signature);

        if (intent.controller != recoveredController) {
            revert ControllerMismatch(intent.controller, recoveredController);
        }

        if (!authorizedControllers[recoveredController]) {
            revert UnauthorizedController(recoveredController);
        }

        if (usedNonces[intent.nonce]) revert NonceAlreadyUsed(intent.nonce);
        usedNonces[intent.nonce] = true;
        if (intent.nonce >= nextNonce) {
            nextNonce = intent.nonce + 1;
        }

        if (block.timestamp > intent.deadline) revert IntentExpired(intent.deadline);
        if (!allowedInputTokens[intent.tokenIn]) revert InputTokenNotAllowed(intent.tokenIn);
        if (!allowedTokens[intent.tokenOut]) revert TokenNotAllowed(intent.tokenOut);
        if (intent.amountIn > maxAmountPerTrade) {
            revert AmountExceedsLimit(intent.amountIn, maxAmountPerTrade);
        }

        uint256 today = block.timestamp / 86400;
        if (today != currentDay) {
            currentDay = today;
            dailyVolumeUsed = 0;
        }
        if (maxDailyVolume > 0 && dailyVolumeUsed + intent.amountIn > maxDailyVolume) {
            revert DailyVolumeExceeded(dailyVolumeUsed + intent.amountIn, maxDailyVolume);
        }

        if (cooldownSeconds > 0 && lastExecution > 0 && block.timestamp < lastExecution + cooldownSeconds) {
            revert CooldownNotMet(lastExecution, cooldownSeconds);
        }

        bytes32 actualExecutionHash = keccak256(executionData);
        if (actualExecutionHash != intent.executionHash) {
            revert ExecutionHashMismatch(intent.executionHash, actualExecutionHash);
        }

        uint256 policyMinimum = (intent.quotedAmountOut * (10_000 - maxSlippageBps)) / 10_000;
        if (intent.minAmountOut < policyMinimum) {
            revert MinAmountOutBelowPolicy(intent.minAmountOut, policyMinimum);
        }

        (bool success, bytes memory returndata) = intent.adapter.delegatecall(
            abi.encodeCall(
                ISwapAdapter.executeSwap,
                (intent.tokenIn, intent.tokenOut, intent.amountIn, executionData)
            )
        );

        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 0x20), mload(returndata))
                }
            }
            revert AdapterExecutionFailed();
        }

        uint256 amountOut = abi.decode(returndata, (uint256));
        if (amountOut < intent.minAmountOut) {
            revert SlippageExceeded(amountOut, intent.minAmountOut);
        }

        dailyVolumeUsed += intent.amountIn;
        lastExecution = block.timestamp;

        bytes32 intentHash = _hashTypedDataV4(structHash);
        jobId = keccak256(abi.encodePacked(intentHash, paymentRef));

        emit ExecutionSucceeded(
            jobId,
            recoveredController,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut
        );

        if (registry != address(0)) {
            IExecutionRegistry(registry).recordReceipt(
                IExecutionRegistry.Receipt({
                    jobId: jobId,
                    vault: address(this),
                    controller: recoveredController,
                    operator: msg.sender,
                    adapter: intent.adapter,
                    paymentRef: paymentRef,
                    tokenIn: intent.tokenIn,
                    tokenOut: intent.tokenOut,
                    amountIn: intent.amountIn,
                    amountOut: amountOut,
                    timestamp: block.timestamp,
                    success: true
                })
            );
        }
    }

    function _hashIntent(ExecutionIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EXECUTION_INTENT_TYPEHASH,
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
    }

    function getIntentHash(ExecutionIntent calldata intent) external view returns (bytes32) {
        return _hashTypedDataV4(_hashIntent(intent));
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _setAuthorizedController(address controller, bool authorized) internal {
        authorizedControllers[controller] = authorized;
        if (authorized) {
            _addAddressToList(authorizedControllerList, authorizedControllerIndex, controller);
        } else {
            _removeAddressFromList(authorizedControllerList, authorizedControllerIndex, controller);
        }
    }

    function _setAllowedInputToken(address token, bool allowed) internal {
        allowedInputTokens[token] = allowed;
        if (allowed) {
            _addAddressToList(allowedInputTokenList, allowedInputTokenIndex, token);
        } else {
            _removeAddressFromList(allowedInputTokenList, allowedInputTokenIndex, token);
        }
    }

    function _setAllowedToken(address token, bool allowed) internal {
        allowedTokens[token] = allowed;
        if (allowed) {
            _addAddressToList(allowedTokenList, allowedTokenIndex, token);
        } else {
            _removeAddressFromList(allowedTokenList, allowedTokenIndex, token);
        }
    }

    function _addAddressToList(
        address[] storage list,
        mapping(address => uint256) storage indexes,
        address value
    ) internal {
        if (indexes[value] != 0) {
            return;
        }

        list.push(value);
        indexes[value] = list.length;
    }

    function _removeAddressFromList(
        address[] storage list,
        mapping(address => uint256) storage indexes,
        address value
    ) internal {
        uint256 index = indexes[value];
        if (index == 0) {
            return;
        }

        uint256 lastIndex = list.length;
        if (index != lastIndex) {
            address lastValue = list[lastIndex - 1];
            list[index - 1] = lastValue;
            indexes[lastValue] = index;
        }

        list.pop();
        delete indexes[value];
    }
}
