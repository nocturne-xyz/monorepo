import { ethers } from "ethers";

const SPEND_KEY_FIXED_MESSAGE = Buffer.from(
  "Sign this message to generate your Nocturne Spending Key. This key lets the application spend your funds in Nocturne.\n\nIMPORTANT: ONLY SIGN THIS MESSAGE IF YOU TRUST THE APPLICATION."
);

export async function generateNocturneSpendKeyFromEoaSig(
  signer: ethers.Signer
): Promise<string> {
  return ethers.utils.keccak256(
    await signer.signMessage(SPEND_KEY_FIXED_MESSAGE)
  );
}
