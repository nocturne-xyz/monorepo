import { ethers } from "ethers";
import { SupportedProvider } from "../types";

export async function getSigner(provider: SupportedProvider): Promise<ethers.Signer> {
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}
