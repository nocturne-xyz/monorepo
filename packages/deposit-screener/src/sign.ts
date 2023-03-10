import {
  Address,
  SignedDepositRequest,
  DepositRequest,
} from "@nocturne-xyz/sdk";
import { TypedDataSigner } from "@ethersproject/abstract-signer"; // TODO: swap out for ethers once v6 includes TypedDataSigner
import {
  DEPOSIT_CHECKER_CONTRACT_NAME,
  DEPOSIT_CHECKER_CONTRACT_VERSION,
  DEPOSIT_REQUEST_TYPES,
  EIP712Domain,
} from "./typedData";

export async function signDepositRequest(
  signer: TypedDataSigner,
  req: DepositRequest,
  depositCheckerAddress: Address
): Promise<SignedDepositRequest> {
  const domain: EIP712Domain = {
    name: DEPOSIT_CHECKER_CONTRACT_NAME,
    version: DEPOSIT_CHECKER_CONTRACT_VERSION,
    chainId: req.chainId,
    verifyingContract: depositCheckerAddress,
  };
  const screenerSig = await signer._signTypedData(
    domain,
    DEPOSIT_REQUEST_TYPES,
    req
  );

  return { depositRequest: req, screenerSig };
}
