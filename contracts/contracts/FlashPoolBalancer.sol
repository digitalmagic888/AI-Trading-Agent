// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IAavePool {
    function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external;
}

interface IFlashRouteExecutor {
    function executeRoute(address asset, uint256 amount, uint256 premium, bytes calldata routeData) external returns (uint256 reportedFinalBalance);
}

contract FlashPoolBalancer {
    IAavePool public immutable pool;
    address public admin;
    address public operator;
    bool public flashExecutionEnabled;
    bool public paused;

    mapping(address => bool) public assetAllowlist;
    mapping(address => bool) public executorAllowlist;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event FlashExecutionEnabled(bool enabled);
    event PauseUpdated(bool paused);
    event AssetAllowlistUpdated(address indexed asset, bool allowed);
    event ExecutorAllowlistUpdated(address indexed executor, bool allowed);
    event RouteRequested(bytes32 indexed routeHash, address indexed asset, uint256 amount, uint256 minProfit, address executor, address operator);
    event RouteSettled(bytes32 indexed routeHash, address indexed asset, uint256 amount, uint256 premium, uint256 profit, uint256 reportedFinalBalance, uint256 actualFinalBalance);

    error NotAdmin();
    error NotOperator();
    error InvalidAddress();
    error FlashExecutionDisabled();
    error Paused();
    error AssetNotAllowed(address asset);
    error ExecutorNotAllowed(address executor);
    error DeadlineExpired(uint256 deadline, uint256 timestamp);
    error InvalidRouteHash();
    error UnauthorizedPoolCaller();
    error InvalidInitiator();
    error UnprofitableRoute(uint256 balance, uint256 requiredBalance);
    error ApprovalFailed(address token, address spender, uint256 amount);

    struct RoutePlan {
        address executor;
        uint256 minProfit;
        uint256 deadline;
        bytes32 routeHash;
        bytes routeData;
    }

    constructor(address aavePool, address initialOperator) {
        if (aavePool == address(0) || initialOperator == address(0)) revert InvalidAddress();
        pool = IAavePool(aavePool);
        admin = msg.sender;
        operator = initialOperator;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier whenActive() {
        if (paused) revert Paused();
        if (!flashExecutionEnabled) revert FlashExecutionDisabled();
        _;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function setOperator(address newOperator) external onlyAdmin {
        if (newOperator == address(0)) revert InvalidAddress();
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function setFlashExecutionEnabled(bool enabled) external onlyAdmin {
        flashExecutionEnabled = enabled;
        emit FlashExecutionEnabled(enabled);
    }

    function setPaused(bool value) external onlyAdmin {
        paused = value;
        emit PauseUpdated(value);
    }

    function setAssetAllowed(address asset, bool allowed) external onlyAdmin {
        if (asset == address(0)) revert InvalidAddress();
        assetAllowlist[asset] = allowed;
        emit AssetAllowlistUpdated(asset, allowed);
    }

    function setExecutorAllowed(address executor, bool allowed) external onlyAdmin {
        if (executor == address(0)) revert InvalidAddress();
        executorAllowlist[executor] = allowed;
        emit ExecutorAllowlistUpdated(executor, allowed);
    }

    function requestFlashRoute(address asset, uint256 amount, RoutePlan calldata plan) external onlyOperator whenActive {
        _validateRoute(asset, plan);
        emit RouteRequested(plan.routeHash, asset, amount, plan.minProfit, plan.executor, msg.sender);
        pool.flashLoanSimple(address(this), asset, amount, abi.encode(plan), 0);
    }

    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool) {
        if (msg.sender != address(pool)) revert UnauthorizedPoolCaller();
        if (initiator != address(this)) revert InvalidInitiator();

        RoutePlan memory plan = abi.decode(params, (RoutePlan));
        _validateRoute(asset, plan);

        _safeApprove(asset, plan.executor, 0);
        _safeApprove(asset, plan.executor, amount);
        uint256 reportedFinalBalance = IFlashRouteExecutor(plan.executor).executeRoute(asset, amount, premium, plan.routeData);
        _safeApprove(asset, plan.executor, 0);

        uint256 actualFinalBalance = IERC20(asset).balanceOf(address(this));
        uint256 requiredBalance = amount + premium + plan.minProfit;
        if (actualFinalBalance < requiredBalance) revert UnprofitableRoute(actualFinalBalance, requiredBalance);

        _safeApprove(asset, address(pool), 0);
        _safeApprove(asset, address(pool), amount + premium);
        emit RouteSettled(plan.routeHash, asset, amount, premium, actualFinalBalance - amount - premium, reportedFinalBalance, actualFinalBalance);
        return true;
    }

    function rescueToken(address token, address to, uint256 amount) external onlyAdmin {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        _safeTransfer(token, to, amount);
    }

    function _validateRoute(address asset, RoutePlan memory plan) internal view {
        if (!assetAllowlist[asset]) revert AssetNotAllowed(asset);
        if (!executorAllowlist[plan.executor]) revert ExecutorNotAllowed(plan.executor);
        if (plan.deadline < block.timestamp) revert DeadlineExpired(plan.deadline, block.timestamp);
        if (plan.routeHash == bytes32(0)) revert InvalidRouteHash();
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, spender, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ApprovalFailed(token, spender, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert InvalidAddress();
    }
}
