import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetType,
  StealthAddress,
  Note,
  // parseEventsFromContractReceipt,
  DepositRequest,
  AssetTrait,
  zip,
} from "@nocturne-xyz/sdk";
import { ethers, ContractTransaction } from "ethers";
import { queryDepositStatus, sleep } from "./utils";
import {
  DepositRequestStatus,
  hashDepositRequest,
} from "@nocturne-xyz/deposit-screener";
import { expect } from "chai";
// import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<[DepositRequest, Note][]> {
  const txs: ContractTransaction[] = [];
  const depositRequests: DepositRequest[] = [];
  const notes: Note[] = [];
  for (const [token, amounts] of tokensWithAmounts) {
    const total = amounts.reduce((sum, a) => sum + a);

    txs.push(await token.reserveTokens(eoa.address, total));

    txs.push(await token.connect(eoa).approve(depositManager.address, total));

    for (const [i, amount] of amounts.entries()) {
      const [tx, depositRequest, note] = await makeDeposit(
        { depositManager, eoa },
        stealthAddress,
        token,
        amount,
        i
      );
      txs.push(tx);
      depositRequests.push(depositRequest);
      notes.push(note);
    }
  }

  await Promise.all(txs.map((tx) => tx.wait(1)));
  await sleep(15_000); // wait for deposit screener

  // for (const depositRequest of depositRequests) {
  //   const depositHash = hashDepositRequest(depositRequest);
  //   const status = await queryDepositStatus(depositHash);
  //   console.log(status);
  //   expect(status.status).to.eql(DepositRequestStatus.Completed);
  // }

  return zip(depositRequests, notes);
}

export async function depositFundsSingleToken(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[]
): Promise<[DepositRequest, Note][]> {
  const total = amounts.reduce((sum, a) => sum + a);

  const txs = [
    await token.reserveTokens(eoa.address, total),
    await token.connect(eoa).approve(depositManager.address, total),
  ];
  const depositRequests: DepositRequest[] = [];
  const notes: Note[] = [];
  for (const [i, amount] of amounts.entries()) {
    const [tx, depositRequest, note] = await makeDeposit(
      { depositManager, eoa },
      stealthAddress,
      token,
      amount,
      i
    );
    txs.push(tx);
    depositRequests.push(depositRequest);
    notes.push(note);
  }

  await Promise.all(txs.map((tx) => tx.wait(1)));
  await sleep(15_000); // wait for deposit screener

  // for (const tx of txs) {
  //   const receipt = await tx.wait();
  //   const depositCompletedEvent = parseEventsFromContractReceipt(
  //     receipt,
  //     this.tellerContract.interface.getEvent("DepositCompleted")
  //   )[0] as DepositCompletedEvent;
  // }

  return zip(depositRequests, notes);
}

interface MakeDepositDeps {
  depositManager: DepositManager;
  eoa: ethers.Wallet;
}

async function makeDeposit(
  { depositManager, eoa }: MakeDepositDeps,
  stealthAddress: StealthAddress,
  token: SimpleERC20Token,
  value: bigint,
  noteNonce: number
): Promise<[ContractTransaction, DepositRequest, Note]> {
  const asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  console.log(`instantiating deposit for ${value} of token ${token.address}`);

  const nonce = await depositManager._nonce();
  const instantiateDepositTx = await depositManager
    .connect(eoa)
    .instantiateErc20MultiDeposit(token.address, [value], stealthAddress);

  return [
    instantiateDepositTx,
    {
      spender: eoa.address,
      nonce: nonce.toBigInt(),
      encodedAsset: AssetTrait.encode(asset),
      depositAddr: stealthAddress,
      value,
      gasCompensation: 0n,
    },
    {
      owner: stealthAddress,
      nonce: BigInt(noteNonce),
      asset,
      value,
    },
  ];
}

// function makeDepositFn(
//   depositManager: DepositManager,
//   eoa: ethers.Wallet,
//   stealthAddress: StealthAddress
// ): (
//   token: SimpleERC20Token,
//   amount: bigint,
//   noteNonce: number
// ) => Promise<[ContractTransaction, Note]> {
//   return async (token: SimpleERC20Token, amount: bigint, noteNonce: number) => {
//     const asset = {
//       assetType: AssetType.ERC20,
//       assetAddr: token.address,
//       id: 0n,
//     };

//     console.log(
//       `instantiating deposit for ${amount} of token ${token.address}`
//     );
//     const instantiateDepositTx = await depositManager
//       .connect(eoa)
//       .instantiateErc20MultiDeposit(token.address, [amount], stealthAddress);

//     return [
//       instantiateDepositTx,
//       {
//         owner: stealthAddress,
//         nonce: BigInt(noteNonce),
//         asset,
//         value: amount,
//       },
//     ];
//   };
// }
