import { Action } from "@nocturne-xyz/core";
import * as ethers from "ethers";

export function getSelector(signature: string): string {
  const sigBytes = ethers.utils.toUtf8Bytes(signature);
  const hash = ethers.utils.keccak256(sigBytes);
  return ethers.utils.hexDataSlice(hash, 0, 4);
}

// same for both ETHTransferAdapter and ERC20 Transfer
const TRANSFER_SELECTOR = getSelector("transfer(address,uint256)");

export type TransferActionCalldata = {
  to: string;
  amount: string;
};

export function isTransferAction(action: Action): boolean {
  const selector = ethers.utils.hexDataSlice(action.encodedFunction, 0, 4);
  return selector === TRANSFER_SELECTOR;
}

export function parseTransferAction(action: Action): TransferActionCalldata {
  if (!isTransferAction(action)) {
    throw new Error("Not an ERC20 transfer action");
  }

  const calldata = ethers.utils.hexDataSlice(action.encodedFunction, 4);
  const { to, amount } = ethers.utils.defaultAbiCoder.decode(
    ["address", "unit256"],
    calldata
  ) as unknown as TransferActionCalldata;

  return { to, amount };
}
