import { ethers } from "ethers";

const SPEND_KEY_FIXED_MESSAGE = Buffer.from(
  `Sign to generate your Nocturne spending key. This key will secure your funds in Nocturne.

By signing this message, I assert that
1. I trust the application
2. I have safely stored the private key (or seed phrase from which the private key was derived) for the connected Ethereum account
3. The only way I can recover access to my Nocturne account is by signing this message again with the current Ethereum account`,
);

export async function generateNocturneSpendKeyFromEoaSig(
  signer: ethers.Signer,
): Promise<string> {
  return ethers.utils.keccak256(
    await signer.signMessage(SPEND_KEY_FIXED_MESSAGE),
  );
}
