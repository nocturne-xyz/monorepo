import { Address } from "../primitives";

export function protocolWhitelistKey(
  contractAddress: Address,
  selector: string
): string {
  const result: bigint =
    (BigInt(contractAddress) << BigInt(32)) | BigInt(selector);
  return "0x" + result.toString(16).padStart(24, "0");
}
