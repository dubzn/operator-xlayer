// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Mock DEX router for testnet. Simulates a swap by taking tokenIn and
///         sending back a fixed amount of tokenOut from its own balance.
///         Fund it with tokenOut before using.
contract MockRouter {
    using SafeERC20 for IERC20;

    /// @notice Simulate a swap. Caller must have approved this contract for tokenIn.
    /// @param tokenIn  The token being sold
    /// @param tokenOut The token being bought
    /// @param amountIn Amount of tokenIn to take from caller
    /// @param amountOut Amount of tokenOut to send to caller
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) external {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
    }
}
