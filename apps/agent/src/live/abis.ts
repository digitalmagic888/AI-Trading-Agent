export const flashPoolBalancerAbi = [
  "constructor(address aavePool,address initialOperator)",
  "function admin() view returns (address)",
  "function operator() view returns (address)",
  "function flashExecutionEnabled() view returns (bool)",
  "function paused() view returns (bool)",
  "function assetAllowlist(address) view returns (bool)",
  "function executorAllowlist(address) view returns (bool)",
  "function setOperator(address newOperator)",
  "function setFlashExecutionEnabled(bool enabled)",
  "function setPaused(bool value)",
  "function setAssetAllowed(address asset,bool allowed)",
  "function setExecutorAllowed(address executor,bool allowed)",
  "function requestFlashRoute(address asset,uint256 amount,(address executor,uint256 minProfit,uint256 deadline,bytes32 routeHash,bytes routeData) plan)",
  "event RouteSettled(bytes32 indexed routeHash,address indexed asset,uint256 amount,uint256 premium,uint256 profit,uint256 reportedFinalBalance,uint256 actualFinalBalance)",
  "error NotAdmin()",
  "error NotOperator()",
  "error FlashExecutionDisabled()",
  "error Paused()",
  "error AssetNotAllowed(address asset)",
  "error ExecutorNotAllowed(address executor)",
  "error DeadlineExpired(uint256 deadline,uint256 timestamp)",
  "error InvalidRouteHash()",
  "error UnauthorizedPoolCaller()",
  "error InvalidInitiator()",
  "error UnprofitableRoute(uint256 balance,uint256 requiredBalance)",
  "error ApprovalFailed(address token,address spender,uint256 amount)"
] as const;

export const v2TwoLegFlashExecutorAbi = [
  "constructor(address initialReceiver)",
  "function admin() view returns (address)",
  "function receiver() view returns (address)",
  "function routerAllowlist(address) view returns (bool)",
  "function tokenAllowlist(address) view returns (bool)",
  "function setRouterAllowed(address router,bool allowed)",
  "function setTokenAllowed(address token,bool allowed)",
  "function executeRoute(address asset,uint256 amount,uint256 premium,bytes routeData) returns (uint256 returnedAmount)",
  "event V2TwoLegRouteExecuted(bytes32 indexed quoteHash,address indexed asset,uint256 amount,uint256 premium,uint256 returnedAmount)",
  "error NotAdmin()",
  "error UnauthorizedCaller()",
  "error InvalidAddress()",
  "error RouterNotAllowed(address router)",
  "error TokenNotAllowed(address token)",
  "error InvalidPath()",
  "error DeadlineExpired(uint256 deadline,uint256 timestamp)",
  "error TransferFailed(address token,address to,uint256 amount)",
  "error ApprovalFailed(address token,address spender,uint256 amount)",
  "error EmptyQuoteHash()"
] as const;

export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)"
] as const;

export const v2RouterAbi = [
  "function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[] amounts)"
] as const;
