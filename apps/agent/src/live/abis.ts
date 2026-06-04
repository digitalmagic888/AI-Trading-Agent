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
  "error ApprovalFailed()"
] as const;

export const mockFlashRouteExecutorAbi = [
  "constructor()",
  "function finalBalance() view returns (uint256)",
  "function setFinalBalance(uint256 value)",
  "function executeRoute(address asset,uint256 amount,uint256 premium,bytes routeData) returns (uint256 reportedFinalBalance)"
] as const;

export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)"
] as const;
