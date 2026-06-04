import { Contract, ContractFactory, getAddress } from "ethers";
import { flashPoolBalancerAbi, v2TwoLegFlashExecutorAbi } from "./abis";
import { compileContract } from "./compiler";
import { boolEnv, loadDotEnv, optionalEnv, requireEnv, splitEnv, updateDotEnv, walletAddressFromEnv } from "./env";
import { configuredGasPrice, contractCodeExists, createCheckedProvider, createPrivateKeyWallet, readBool, waitForCode } from "./rpc";

async function sendIfNeeded(label: string, enabled: boolean, send: () => Promise<{ wait: () => Promise<unknown>; hash: string }>): Promise<string | undefined> {
  if (enabled) return undefined;
  const tx = await send();
  console.log(`${label}_tx=${tx.hash}`);
  await tx.wait();
  return tx.hash;
}

async function allowReceiverAssets(receiver: Contract, assets: string[]): Promise<string[]> {
  const txs: string[] = [];
  for (const asset of assets) {
    const normalized = getAddress(asset);
    if (await readBool(receiver, "assetAllowlist", normalized)) continue;
    const tx = await receiver.getFunction("setAssetAllowed")(normalized, true, { gasPrice: configuredGasPrice() });
    console.log(`receiver_asset_allow_tx=${normalized}:${tx.hash}`);
    await tx.wait();
    txs.push(tx.hash);
  }
  return txs;
}

async function allowExecutorRouters(executor: Contract, routers: string[]): Promise<string[]> {
  const txs: string[] = [];
  for (const router of routers) {
    const normalized = getAddress(router);
    if (await readBool(executor, "routerAllowlist", normalized)) continue;
    const tx = await executor.getFunction("setRouterAllowed")(normalized, true, { gasPrice: configuredGasPrice() });
    console.log(`executor_router_allow_tx=${normalized}:${tx.hash}`);
    await tx.wait();
    txs.push(tx.hash);
  }
  return txs;
}

async function allowExecutorTokens(executor: Contract, tokens: string[]): Promise<string[]> {
  const txs: string[] = [];
  for (const token of tokens) {
    const normalized = getAddress(token);
    if (await readBool(executor, "tokenAllowlist", normalized)) continue;
    const tx = await executor.getFunction("setTokenAllowed")(normalized, true, { gasPrice: configuredGasPrice() });
    console.log(`executor_token_allow_tx=${normalized}:${tx.hash}`);
    await tx.wait();
    txs.push(tx.hash);
  }
  return txs;
}

function initialRouters(): string[] {
  const routers = ["PANCAKESWAP_ROUTER", "BISWAP_ROUTER", "BISWAP_V2_ROUTER", "UNISWAP_V2_ROUTER"]
    .map((name) => optionalEnv(name))
    .filter((value): value is string => Boolean(value))
    .map((value) => getAddress(value));
  return [...new Set(routers.map((router) => router.toLowerCase()))].map((router) => getAddress(router));
}

function initialTokens(): string[] {
  return ["TOKEN_USDT", "TOKEN_WBNB"].map((name) => requireEnv(name));
}

export async function deployAndConfigureContracts(): Promise<Record<string, string | number | boolean>> {
  loadDotEnv();
  const provider = await createCheckedProvider();
  const deployer = await createPrivateKeyWallet(provider);
  const hotWalletAddress = walletAddressFromEnv("HOT_WALLET_PRIVATE_KEY");
  const aavePool = getAddress(requireEnv("AAVE_POOL_ADDRESS"));
  const previousReceiver = optionalEnv("FLASH_RECEIVER_ADDRESS");
  const existingReceiverHasCode = await contractCodeExists(provider, previousReceiver);
  const deployNew = boolEnv("DEPLOY_NEW_FLASH_RECEIVER", false) || !existingReceiverHasCode;
  if (!deployNew && previousReceiver) {
    throw new Error(`FLASH_RECEIVER_ADDRESS already has code at ${previousReceiver}. Set DEPLOY_NEW_FLASH_RECEIVER=true to deploy and replace it.`);
  }

  const flashCompiled = compileContract("FlashPoolBalancer.sol", "FlashPoolBalancer");
  const executorCompiled = compileContract("V2TwoLegFlashExecutor.sol", "V2TwoLegFlashExecutor");

  const flashFactory = new ContractFactory(flashCompiled.abi, flashCompiled.bytecode, deployer);
  const receiver = await flashFactory.deploy(aavePool, hotWalletAddress, { gasPrice: configuredGasPrice() });
  const receiverDeployTx = receiver.deploymentTransaction()?.hash ?? "";
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  await waitForCode(provider, receiverAddress);

  const executorFactory = new ContractFactory(executorCompiled.abi, executorCompiled.bytecode, deployer);
  const executor = await executorFactory.deploy(receiverAddress, { gasPrice: configuredGasPrice() });
  const executorDeployTx = executor.deploymentTransaction()?.hash ?? "";
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  await waitForCode(provider, executorAddress);

  const configuredReceiver = new Contract(receiverAddress, flashPoolBalancerAbi, deployer);
  const configuredExecutor = new Contract(executorAddress, v2TwoLegFlashExecutorAbi, deployer);

  const executorAllowed = await readBool(configuredReceiver, "executorAllowlist", executorAddress);
  const executorAllowTx = await sendIfNeeded("receiver_executor_allow", executorAllowed, () => configuredReceiver.getFunction("setExecutorAllowed")(executorAddress, true, { gasPrice: configuredGasPrice() }));
  const flashEnabled = await readBool(configuredReceiver, "flashExecutionEnabled");
  const flashEnableTx = await sendIfNeeded("receiver_flash_enable", flashEnabled, () => configuredReceiver.getFunction("setFlashExecutionEnabled")(true, { gasPrice: configuredGasPrice() }));
  const paused = await readBool(configuredReceiver, "paused");
  const unpauseTx = paused ? await sendIfNeeded("receiver_unpause", false, () => configuredReceiver.getFunction("setPaused")(false, { gasPrice: configuredGasPrice() })) : undefined;
  const receiverAssetAllowTxs = await allowReceiverAssets(configuredReceiver, initialTokens());
  const executorRouterAllowTxs = await allowExecutorRouters(configuredExecutor, initialRouters());
  const executorTokenAllowTxs = await allowExecutorTokens(configuredExecutor, initialTokens());

  const updates: Record<string, string> = {
    FLASH_RECEIVER_ADDRESS: receiverAddress,
    FLASH_ROUTE_EXECUTOR_ADDRESS: executorAddress,
    FLASH_RECEIVER_ADMIN_ADDRESS: deployer.address,
    HOT_WALLET_ADDRESS: hotWalletAddress,
    FLASH_RECEIVER_DEPLOYED_AT: new Date().toISOString(),
    LAST_EXECUTOR_DEPLOY_TX: executorDeployTx,
    LAST_CONTRACT_DEPLOY_TX: receiverDeployTx,
    LAST_CONTRACT_CONFIG_TXS: [
      executorAllowTx,
      flashEnableTx,
      unpauseTx,
      ...receiverAssetAllowTxs,
      ...executorRouterAllowTxs,
      ...executorTokenAllowTxs
    ].filter(Boolean).join(",")
  };
  if (previousReceiver && previousReceiver.toLowerCase() !== receiverAddress.toLowerCase()) {
    updates.FLASH_RECEIVER_PREVIOUS_ADDRESS = previousReceiver;
  }
  updateDotEnv(updates);

  return {
    receiverAddress,
    executorAddress,
    deployer: deployer.address,
    hotWalletAddress,
    deployedNewReceiver: true,
    allowedRouterCount: initialRouters().length,
    allowedTokenCount: initialTokens().length,
    receiverDeployTx,
    executorDeployTx
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await deployAndConfigureContracts();
  console.log(JSON.stringify(result, null, 2));
}
