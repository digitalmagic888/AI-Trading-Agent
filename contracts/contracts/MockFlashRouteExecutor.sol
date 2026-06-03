// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockFlashRouteExecutor {
    uint256 public finalBalance;

    function setFinalBalance(uint256 value) external {
        finalBalance = value;
    }

    function executeRoute(address, uint256, uint256, bytes calldata) external view returns (uint256) {
        return finalBalance;
    }
}
