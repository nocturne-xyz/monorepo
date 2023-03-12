import { DepositRequest } from "@nocturne-xyz/sdk";
import { TypedDataSigner } from "@ethersproject/abstract-signer"; // TODO: replace with ethers post update
import { DEPOSIT_REQUEST_TYPES, EIP712Domain } from "./typedData";

export async function signDepositRequest(
  signer: TypedDataSigner,
  domain: EIP712Domain,
  req: DepositRequest
): Promise<string> {
  return await signer._signTypedData(domain, DEPOSIT_REQUEST_TYPES, req);
}
