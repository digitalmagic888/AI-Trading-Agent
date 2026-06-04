import { Contract, ContractFactory, getAddress, Wallet } from "ethers";
import { flashPoolBalancerAbi, mockFlashRouteExecutorAbi } from "./abis";
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

async function allowAssets(receiver: Contract, assets: string[]): Promise<string[]> {
  const txs: string[] = [];
  for (const asset of assets) {
    const normalized = getAddress(asset);
    if (await readBool(receiver, "assetAllowlist", normalized)) continue;
    const tx = await receiver.getFunction("setAssetAllowed")(normalized, true, { gasPrice: configuredGasPrice() });
    console.log(`asset_allow_tx=${normalized}:${tx.hash}`);
    await tx.wait();
    txs.push(tx.hash);
  }
  return txs;
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

  let receiverAddress = previousReceiver ? getAddress(previousReceiver) : "";
  let receiverDeployTx = "";
  let executorDeployTx = "";
  const flashCompiled = compileContract("FlashPoolBalancer.sol", "FlashPoolBalancer");
  const mockCompiled = compileContract("MockFlashRouteExecutor.sol", "MockFlashRouteExecutor");

  const executorFactory = new ContractFactory(mockCompiled.abi, mockCompiled.bytecode, deployer);
  const executor = await executorFactory.deploy({ gasPrice: configuredGasPrice() });
  executorDeployTx = executor.deploymentTransaction()?.hash ?? "";
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  await waitForCode(provider, executorAddress);

  if (deployNew) {
    const flashFactory = new ContractFactory(flashCompiled.abi, flashCompiled.bytecode, deployer);
    const receiver = await flashFactory.deploy(aavePool, hotWalletAddress, { gasPrice: configuredGasPrice() });
    receiverDeployTx = receiver.deploymentTransaction()?.hash ?? "";
    await receiver.waitForDeployment();
    receiverAddress = await receiver.getAddress();
    await waitForCode(provider, receiverAddress);
  } else if (previousReceiver) {
    throw new Error(`FLASH_RECEIVER_ADDRESS already has code at ${previousReceiver}. Set DEPLOY_NEW_FLASH_RECEIVER=true to deploy and replace it.`);
  }

  const receiver = new Contract(receiverAddress, flashPoolBalancerAbi, deployer);
  const currentOperator = String(await receiver.getFunction("operator")());
  if (currentOperator.toLowerCase() !== hotWalletAddress.toLowerCase()) {
    const tx = await receiver.getFunction("setOperator")(hotWalletAddress, { gasPrice: configuredGasPrice() });
    console.log(`set_operator_tx=${tx.hash}`);
    await tx.wait();
  }

  const executorAllowed = await readBool(receiver, "executorAllowlist", executorAddress);
  const executorAllowTx = await sendIfNeeded("executor_allow", executorAllowed, () => receiver.getFunction("setExecutorAllowed")(executorAddress, true, { gasPrice: configuredGasPrice() }));
  const flashEnabled = await readBool(receiver, "flashExecutionEnabled");
  const flashEnableTx = await sendIfNeeded("flash_enable", flashEnabled, () => receiver.getFunction("setFlashExecutionEnabled")(true, { gasPrice: configuredGasPrice() }));
  const paused = await readBool(receiver, "paused");
  const unpauseTx = paused ? await sendIfNeeded("unpause", false, () => receiver.getFunction("setPaused")(false, { gasPrice: configuredGasPrice() })) : undefined;
  const assetAllowTxs = await allowAssets(receiver, splitEnv("TOKEN_ADDRESS_ALLOWLIST"));

  const updates: Record<string, string> = {
    FLASH_RECEIVER_ADDRESS: receiverAddress,
    FLASH_ROUTE_EXECUTOR_ADDRESS: executorAddress,
    FLASH_RECEIVER_ADMIN_ADDRESS: deployer.address,
    HOT_WALLET_ADDRESS: hotWalletAddress,
    FLASH_RECEIVER_DEPLOYED_AT: new Date().toISOString(),
    LAST_EXECUTOR_DEPLOY_TX: executorDeployTx,
    LAST_CONTRACT_DEPLOY_TX: receiverDeployTx,
    LAST_CONTRACT_CONFIG_TXS: [executorAllowTx, flashEnableTx, unpauseTx, ...assetAllowTxs].filter(Boolean).join(",")
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
    deployedNewReceiver: deployNew,
    allowedAssetCount: splitEnv("TOKEN_ADDRESS_ALLOWLIST").length,
    receiverDeployTx,
    executorDeployTx
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await deployAndConfigureContracts();
  console.log(JSON.stringify(result, null, 2));
}
