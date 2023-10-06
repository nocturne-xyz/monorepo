import { ethers } from "ethers";

const SPEND_KEY_FIXED_MESSAGE = Buffer.from(
  "Sign this message to generate your Nocturne Spending Key. This key lets the application spend your funds in Nocturne.\n\nIMPORTANT: Only sign this message if you trust the application."
);

export async function generateNocturneSpendKey(
  signer: ethers.Signer
): Promise<Uint8Array> {
  return ethers.utils.arrayify(
    ethers.utils.keccak256(
      ethers.utils.arrayify(await signer.signMessage(SPEND_KEY_FIXED_MESSAGE))
    )
  );
}
