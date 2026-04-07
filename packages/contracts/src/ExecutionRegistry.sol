// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutionRegistry} from "./interfaces/IExecutionRegistry.sol";

contract ExecutionRegistry is IExecutionRegistry {
    address public owner;
    mapping(bytes32 => Receipt) private _receipts;
    mapping(address => bool) public authorizedVaults;
    mapping(address => uint256) public successCount;

    event ReceiptRecorded(bytes32 indexed jobId, address indexed vault, address indexed operator);
    event VaultAuthorized(address indexed vault);
    event VaultRevoked(address indexed vault);

    error OnlyOwner();
    error ReceiptAlreadyExists(bytes32 jobId);
    error UnauthorizedRecorder(address recorder);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeVault(address vault) external onlyOwner {
        authorizedVaults[vault] = true;
        emit VaultAuthorized(vault);
    }

    function revokeVault(address vault) external onlyOwner {
        authorizedVaults[vault] = false;
        emit VaultRevoked(vault);
    }

    function recordReceipt(Receipt calldata receipt) external {
        if (!authorizedVaults[msg.sender]) {
            revert UnauthorizedRecorder(msg.sender);
        }
        if (_receipts[receipt.jobId].timestamp != 0) {
            revert ReceiptAlreadyExists(receipt.jobId);
        }
        _receipts[receipt.jobId] = receipt;
        if (receipt.success) {
            successCount[receipt.operator] += 1;
        }
        emit ReceiptRecorded(receipt.jobId, receipt.vault, receipt.operator);
    }

    function getReceipt(bytes32 jobId) external view returns (Receipt memory) {
        return _receipts[jobId];
    }

    function getTrackRecord(address operator) external view returns (uint256) {
        return successCount[operator];
    }
}
