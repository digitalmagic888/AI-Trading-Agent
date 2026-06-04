// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
}

interface IV2RouterLike {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
}

contract V2TwoLegFlashExecutor {
    address public immutable receiver;
    address public admin;

    mapping(address => bool) public routerAllowlist;
    mapping(address => bool) public tokenAllowlist;

    event RouterAllowlistUpdated(address indexed router, bool allowed);
    event TokenAllowlistUpdated(address indexed token, bool allowed);
    event V2TwoLegRouteExecuted(bytes32 indexed quoteHash, address indexed asset, uint256 amount, uint256 premium, uint256 returnedAmount);

    error NotAdmin();
    error UnauthorizedCaller();
    error InvalidAddress();
    error RouterNotAllowed(address router);
    error TokenNotAllowed(address token);
    error InvalidPath();
    error DeadlineExpired(uint256 deadline, uint256 timestamp);
    error TransferFailed(address token, address to, uint256 amount);
    error ApprovalFailed(address token, address spender, uint256 amount);
    error EmptyQuoteHash();

    struct V2TwoLegRoute {
        address buyRouter;
        address sellRouter;
        address[] buyPath;
        address[] sellPath;
        uint256 amountOutMinBuy;
        uint256 amountOutMinSell;
        uint256 deadline;
        bytes32 quoteHash;
    }

    constructor(address initialReceiver) {
        if (initialReceiver == address(0)) revert InvalidAddress();
        receiver = initialReceiver;
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function setRouterAllowed(address router, bool allowed) external onlyAdmin {
        if (router == address(0)) revert InvalidAddress();
        routerAllowlist[router] = allowed;
        emit RouterAllowlistUpdated(router, allowed);
    }

    function setTokenAllowed(address token, bool allowed) external onlyAdmin {
        if (token == address(0)) revert InvalidAddress();
        tokenAllowlist[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    function executeRoute(address asset, uint256 amount, uint256 premium, bytes calldata routeData) external returns (uint256 returnedAmount) {
        if (msg.sender != receiver) revert UnauthorizedCaller();
        V2TwoLegRoute memory route = abi.decode(routeData, (V2TwoLegRoute));
        _validateRoute(asset, route);

        _safeTransferFrom(asset, receiver, address(this), amount);
        _safeApprove(asset, route.buyRouter, 0);
        _safeApprove(asset, route.buyRouter, amount);
        uint256[] memory buyAmounts = IV2RouterLike(route.buyRouter).swapExactTokensForTokens(amount, route.amountOutMinBuy, route.buyPath, address(this), route.deadline);
        _safeApprove(asset, route.buyRouter, 0);

        address middleAsset = route.buyPath[route.buyPath.length - 1];
        uint256 middleAmount = buyAmounts[buyAmounts.length - 1];
        _safeApprove(middleAsset, route.sellRouter, 0);
        _safeApprove(middleAsset, route.sellRouter, middleAmount);
        IV2RouterLike(route.sellRouter).swapExactTokensForTokens(middleAmount, route.amountOutMinSell, route.sellPath, address(this), route.deadline);
        _safeApprove(middleAsset, route.sellRouter, 0);

        returnedAmount = IERC20Like(asset).balanceOf(address(this));
        _safeTransfer(asset, receiver, returnedAmount);
        emit V2TwoLegRouteExecuted(route.quoteHash, asset, amount, premium, returnedAmount);
        return returnedAmount;
    }

    function rescueToken(address token, address to, uint256 amount) external onlyAdmin {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        _safeTransfer(token, to, amount);
    }

    function _validateRoute(address asset, V2TwoLegRoute memory route) internal view {
        if (route.quoteHash == bytes32(0)) revert EmptyQuoteHash();
        if (route.deadline < block.timestamp) revert DeadlineExpired(route.deadline, block.timestamp);
        if (!routerAllowlist[route.buyRouter]) revert RouterNotAllowed(route.buyRouter);
        if (!routerAllowlist[route.sellRouter]) revert RouterNotAllowed(route.sellRouter);
        if (route.buyPath.length != 2 || route.sellPath.length != 2) revert InvalidPath();
        if (route.buyPath[0] != asset) revert InvalidPath();
        if (route.sellPath[route.sellPath.length - 1] != asset) revert InvalidPath();
        if (route.buyPath[route.buyPath.length - 1] != route.sellPath[0]) revert InvalidPath();
        _validateTokens(route.buyPath);
        _validateTokens(route.sellPath);
    }

    function _validateTokens(address[] memory path) internal view {
        for (uint256 i = 0; i < path.length; i++) {
            if (!tokenAllowlist[path[i]]) revert TokenNotAllowed(path[i]);
        }
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed(token, to, amount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed(token, to, amount);
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, spender, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ApprovalFailed(token, spender, amount);
    }
}
