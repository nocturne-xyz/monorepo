import "mocha";
import { expect } from "chai";
import * as ethers from "ethers";
import { Action, Address } from "@nocturne-xyz/core";
import {
  EthTransferAdapter__factory,
  WstethAdapter__factory,
} from "@nocturne-xyz/contracts";
import { DUMMY_ADDRESSES, DUMMY_CONTRACT_ADDRESS } from "./utils";
import { isTransferAction, parseTransferAction } from "../src/actionParsing";
import ERC20_ABI from "./abis/ERC20.json";

describe("Action Decoding", () => {
  it("detects transfer actions", () => {
    const ethTransferAction = dummyEthTransferAction(DUMMY_ADDRESSES[0], 100n);
    expect(isTransferAction(ethTransferAction)).to.be.true;

    const erc20TransferAction = dummyErc20TransferAction(
      DUMMY_ADDRESSES[0],
      100n
    );
    expect(isTransferAction(erc20TransferAction)).to.be.true;

    const erc20ApproveAction = dummyErc20ApproveAction(
      DUMMY_ADDRESSES[0],
      100n
    );
    expect(isTransferAction(erc20ApproveAction)).to.be.false;

    const wstethDepositAction = dummyWstethDepositAction(100n);
    expect(isTransferAction(wstethDepositAction)).to.be.false;
  });

  it("correctly parses ETH transfer actions", () => {
    const ethTransferAction = dummyEthTransferAction(DUMMY_ADDRESSES[0], 100n);
    const { to, amount } = parseTransferAction(ethTransferAction);
    expect(to).to.equal(DUMMY_ADDRESSES[0]);
    expect(amount).to.equal("100");
  });

  it("correctly parses ERC20 transfer actions", () => {
    const erc20TransferAction = dummyErc20TransferAction(
      DUMMY_ADDRESSES[0],
      100n
    );
    const { to, amount } = parseTransferAction(erc20TransferAction);
    expect(to).to.equal(DUMMY_ADDRESSES[0]);
    expect(amount).to.equal("100");
  });
});

function dummyEthTransferAction(recipient: Address, amount: bigint): Action {
  const encodedFunction =
    EthTransferAdapter__factory.createInterface().encodeFunctionData(
      "transfer",
      [recipient, amount]
    );

  return {
    contractAddress: DUMMY_CONTRACT_ADDRESS,
    encodedFunction,
  };
}

function dummyErc20TransferAction(recipient: Address, amount: bigint): Action {
  const contract = new ethers.Contract(DUMMY_CONTRACT_ADDRESS, ERC20_ABI);

  const encodedFunction = contract.interface.encodeFunctionData("transfer", [
    recipient,
    amount,
  ]);

  return {
    contractAddress: DUMMY_CONTRACT_ADDRESS,
    encodedFunction,
  };
}

function dummyErc20ApproveAction(spender: Address, amount: bigint): Action {
  const contract = new ethers.Contract(DUMMY_CONTRACT_ADDRESS, ERC20_ABI);

  const encodedFunction = contract.interface.encodeFunctionData("approve", [
    spender,
    amount,
  ]);

  return {
    contractAddress: DUMMY_CONTRACT_ADDRESS,
    encodedFunction,
  };
}

function dummyWstethDepositAction(amount: bigint): Action {
  const encodedFunction =
    WstethAdapter__factory.createInterface().encodeFunctionData("deposit", [
      amount,
    ]);

  return {
    contractAddress: DUMMY_CONTRACT_ADDRESS,
    encodedFunction,
  };
}
