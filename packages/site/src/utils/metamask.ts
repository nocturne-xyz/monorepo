import * as ethers from "ethers";
import { Wallet__factory } from "@nocturne-xyz/contracts";

const WALLET_ADDRESS = "0x9e4Fa3251ee437379398e486E9A27A997d90ce51";

/**
 * Detect if the wallet injecting the ethereum object is Flask.
 *
 * @returns True if the MetaMask version is Flask, false otherwise.
 */
export const isFlask = async () => {
  const provider = window.ethereum;

  try {
    const clientVersion = await provider?.request({
      method: "web3_clientVersion",
    });

    const isFlaskDetected = (clientVersion as string[])?.includes("flask");

    return Boolean(provider && isFlaskDetected);
  } catch {
    return false;
  }
};

export const connectWalletContract = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  return Wallet__factory.connect(WALLET_ADDRESS, signer);
};
