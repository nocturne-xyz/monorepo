import { ethers } from "ethers";

const SPEND_KEY_FIXED_MESSAGE = Buffer.from(
  `Generate your Spending Key

  1. Verify you're on: https://app.nocturne.xyz before proceeding
  2. Verify that you have access to the connected wallet's private key. This spending key is unique to your connected wallet address. 
  3. Nocturne cannot recover your spending key or your wallet's private key for you.

  By signing, you will generate your spending key to manage Nocturne funds.`,
);

export async function generateNocturneSpendKeyFromEoaSig(
  signer: ethers.Signer,
): Promise<string> {
  return ethers.utils.keccak256(
    await signer.signMessage(SPEND_KEY_FIXED_MESSAGE),
  );
}
