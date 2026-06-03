// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IAavePool {
    function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external;
}

interface IFlashRouteExecutor {
    function executeRoute(address asset, uint256 amount, uint256 premium, bytes calldata routeData) external returns (uint256 finalBalance);
}

contract FlashPoolBalancer {
    IAavePool public immutable pool;
    address public owner;
    bool public flashExecutionEnabled;

    event FlashExecutionEnabled(bool enabled);
    event RouteRequested(address indexed asset, uint256 amount, uint256 minProfit);
    event RouteSettled(address indexed asset, uint256 amount, uint256 premium, uint256 profit);

    error NotOwner();
    error FlashExecutionDisabled();
    error UnauthorizedPoolCaller();
    error InvalidInitiator();
    error UnprofitableRoute(uint256 balance, uint256 requiredBalance);
    error ApprovalFailed();

    struct RoutePlan {
        address executor;
        uint256 minProfit;
        bytes routeData;
    }

    constructor(address aavePool) {
        pool = IAavePool(aavePool);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setFlashExecutionEnabled(bool enabled) external onlyOwner {
        flashExecutionEnabled = enabled;
        emit FlashExecutionEnabled(enabled);
    }

    function requestFlashRoute(address asset, uint256 amount, RoutePlan calldata plan) external onlyOwner {
        if (!flashExecutionEnabled) revert FlashExecutionDisabled();
        emit RouteRequested(asset, amount, plan.minProfit);
        pool.flashLoanSimple(address(this), asset, amount, abi.encode(plan), 0);
    }

    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool) {
        if (msg.sender != address(pool)) revert UnauthorizedPoolCaller();
        if (initiator != address(this)) revert InvalidInitiator();

        RoutePlan memory plan = abi.decode(params, (RoutePlan));
        uint256 finalBalance = IFlashRouteExecutor(plan.executor).executeRoute(asset, amount, premium, plan.routeData);
        uint256 requiredBalance = amount + premium + plan.minProfit;
        if (finalBalance < requiredBalance) revert UnprofitableRoute(finalBalance, requiredBalance);

        if (!IERC20(asset).approve(address(pool), amount + premium)) revert ApprovalFailed();
        emit RouteSettled(asset, amount, premium, finalBalance - amount - premium);
        return true;
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
