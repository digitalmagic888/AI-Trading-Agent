import { formatEther, parseEther, Wallet } from "ethers";
import { loadDotEnv, numberEnv, requireEnv, updateDotEnv, walletAddressFromEnv } from "./env";
import { configuredGasPrice, createCheckedProvider, createPrivateKeyWallet } from "./rpc";

export async function fundHotWalletToTarget(): Promise<Record<string, string | boolean>> {
  loadDotEnv();
  const provider = await createCheckedProvider();
  const funder = await createPrivateKeyWallet(provider);
  const hotWallet = new Wallet(requireEnv("HOT_WALLET_PRIVATE_KEY"));
  const hotAddress = walletAddressFromEnv("HOT_WALLET_PRIVATE_KEY");
  if (hotWallet.address !== hotAddress) throw new Error("Hot wallet derivation mismatch.");

  const targetBnb = String(numberEnv("FUND_HOT_WALLET_TARGET_BNB", 0.009));
  const target = parseEther(targetBnb);
  const hotBalance = await provider.getBalance(hotAddress);
  if (hotBalance >= target) {
    updateDotEnv({ HOT_WALLET_ADDRESS: hotAddress, HOT_WALLET_FUNDED_AT: new Date().toISOString() });
    return {
      funded: false,
      reason: "hot wallet already meets target",
      hotWalletAddress: hotAddress,
      hotWalletBalanceBnb: formatEther(hotBalance),
      targetBnb
    };
  }

  const amount = target - hotBalance;
  const funderBalance = await provider.getBalance(funder.address);
  const gasPrice = configuredGasPrice();
  const gasCost = gasPrice * 21_000n;
  if (funderBalance <= amount + gasCost) {
    throw new Error(`Insufficient funder balance. Need ${formatEther(amount + gasCost)} BNB, have ${formatEther(funderBalance)} BNB.`);
  }

  const tx = await funder.sendTransaction({ to: hotAddress, value: amount, gasLimit: 21_000n, gasPrice });
  console.log(`fund_hot_wallet_tx=${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Funding transaction failed: ${tx.hash}`);
  const newBalance = await provider.getBalance(hotAddress);
  updateDotEnv({
    HOT_WALLET_ADDRESS: hotAddress,
    HOT_WALLET_LAST_FUNDING_TX: tx.hash,
    HOT_WALLET_FUNDED_AT: new Date().toISOString()
  });

  return {
    funded: true,
    hotWalletAddress: hotAddress,
    sentBnb: formatEther(amount),
    hotWalletBalanceBnb: formatEther(newBalance),
    txHash: tx.hash
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await fundHotWalletToTarget();
  console.log(JSON.stringify(result, null, 2));
}
