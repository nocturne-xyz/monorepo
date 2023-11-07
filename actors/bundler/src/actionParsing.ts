import { Action } from "@nocturne-xyz/core";
import * as ethers from "ethers";

export function getSelector(signature: string): string {
  const sigBytes = ethers.utils.toUtf8Bytes(signature);
  const hash = ethers.utils.keccak256(sigBytes);
  return ethers.utils.hexDataSlice(hash, 0, 4);
}

const ERC20_TRANSFER_SELECTOR = getSelector("transfer(address,uint256)");

export type Erc20ActionCalldata = {
  to: string;
  amount: string;
};

export function isErc20TransferAction(action: Action): boolean {
  const selector = ethers.utils.hexDataSlice(action.encodedFunction, 0, 4);
  return selector === ERC20_TRANSFER_SELECTOR;
}

export function parseErc20Transfer(action: Action): Erc20ActionCalldata {
  if (!isErc20TransferAction(action)) {
    throw new Error("Not an ERC20 transfer action");
  }

  const calldata = ethers.utils.hexDataSlice(action.encodedFunction, 4);
  const { to, amount } = ethers.utils.defaultAbiCoder.decode(
    ["address", "unit256"],
    calldata
  ) as unknown as Erc20ActionCalldata;

  return { to, amount };
}
