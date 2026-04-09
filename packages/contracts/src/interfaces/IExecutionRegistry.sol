// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IExecutionRegistry {
    struct Receipt {
        bytes32 jobId;
        address vault;
        address controller;
        address operator;
        bytes32 paymentRef;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 timestamp;
        bool success;
    }

    function recordReceipt(Receipt calldata receipt) external;
    function getReceipt(bytes32 jobId) external view returns (Receipt memory);
    function authorizeVault(address vault) external;
}
