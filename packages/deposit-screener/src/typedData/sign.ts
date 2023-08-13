import { DepositRequest } from "@nocturne-xyz/core";
import { TypedDataSigner } from "@ethersproject/abstract-signer"; // TODO: replace with ethers post update
import { DEPOSIT_REQUEST_TYPES } from "./constants";

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
}

export async function signDepositRequest(
  signer: TypedDataSigner,
  domain: EIP712Domain,
  depositRequest: DepositRequest
): Promise<string> {
  return await signer._signTypedData(
    domain,
    DEPOSIT_REQUEST_TYPES,
    depositRequest
  );
}
