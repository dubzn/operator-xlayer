// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

contract OkxAggregatorSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    address public immutable router;
    address public immutable approvalTarget;

    error SwapCallFailed();

    constructor(address _router, address _approvalTarget) {
        router = _router;
        approvalTarget = _approvalTarget == address(0) ? _router : _approvalTarget;
    }

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata executionData
    ) external returns (uint256 amountOut) {
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        IERC20(tokenIn).forceApprove(approvalTarget, 0);
        IERC20(tokenIn).forceApprove(approvalTarget, amountIn);

        (bool success, bytes memory returndata) = router.call(executionData);
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 0x20), mload(returndata))
                }
            }
            revert SwapCallFailed();
        }

        amountOut = IERC20(tokenOut).balanceOf(address(this)) - balanceBefore;
    }
}
