import { ethers } from "ethers";

export const DEFAULT_SNAP_ORIGIN =
  process.env.REACT_APP_SNAP_ORIGIN ?? `local:http://localhost:8080`;

export async function getWindowSigner(): Promise<ethers.Signer> {
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}
