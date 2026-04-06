// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutionRegistry} from "./interfaces/IExecutionRegistry.sol";

contract ExecutionRegistry is IExecutionRegistry {
    mapping(bytes32 => Receipt) private _receipts;

    event ReceiptRecorded(bytes32 indexed jobId, address indexed vault, address indexed operator);

    error ReceiptAlreadyExists(bytes32 jobId);

    function recordReceipt(Receipt calldata receipt) external {
        if (_receipts[receipt.jobId].timestamp != 0) {
            revert ReceiptAlreadyExists(receipt.jobId);
        }
        _receipts[receipt.jobId] = receipt;
        emit ReceiptRecorded(receipt.jobId, receipt.vault, receipt.operator);
    }

    function getReceipt(bytes32 jobId) external view returns (Receipt memory) {
        return _receipts[jobId];
    }
}
