import { Contract, formatEther, JsonRpcProvider, parseUnits, Wallet } from "ethers";
import { boolEnv, loadDotEnv, numberEnv, requireEnv } from "./env";

export const BSC_MAINNET_CHAIN_ID = 56n;

export async function createCheckedProvider(): Promise<JsonRpcProvider> {
  loadDotEnv();
  const provider = new JsonRpcProvider(requireEnv("BSC_RPC_URL"));
  const network = await provider.getNetwork();
  if (network.chainId !== BSC_MAINNET_CHAIN_ID && !boolEnv("ALLOW_NON_BSC_CHAIN", false)) {
    throw new Error(`Refusing chainId=${network.chainId}; expected BSC mainnet chainId=56`);
  }
  return provider;
}

export async function createPrivateKeyWallet(provider: JsonRpcProvider): Promise<Wallet> {
  const wallet = new Wallet(requireEnv("PRIVATE_KEY"), provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(JSON.stringify({ deployer: wallet.address, deployerBalanceBnb: formatEther(balance) }, null, 2));
  return wallet;
}

export async function waitForCode(provider: JsonRpcProvider, address: string): Promise<void> {
  const code = await provider.getCode(address);
  if (code === "0x") throw new Error(`No contract code at ${address}`);
}

export async function contractCodeExists(provider: JsonRpcProvider, address: string | undefined): Promise<boolean> {
  if (!address) return false;
  if (!address.match(/^0x[0-9a-fA-F]{40}$/)) return false;
  return (await provider.getCode(address)) !== "0x";
}

export async function readBool(contract: Contract, fn: string, arg?: string): Promise<boolean> {
  const method = contract.getFunction(fn);
  const value = arg ? await method(arg) : await method();
  return Boolean(value);
}

export function configuredGasPrice(): bigint {
  return parseUnits(String(numberEnv("BSC_GAS_PRICE_GWEI", 1)), "gwei");
}
