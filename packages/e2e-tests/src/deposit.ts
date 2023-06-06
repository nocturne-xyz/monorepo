import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetTrait,
  AssetType,
  DepositRequest,
  Note,
  StealthAddress,
  StealthAddressTrait,
  hashDepositRequest,
  zip,
} from "@nocturne-xyz/sdk";
import { ContractTransaction, ethers } from "ethers";
import { queryDepositStatus, sleep } from "./utils";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  shouldQueryDepositStatus = true
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

  if (shouldQueryDepositStatus) {
    let ctr = 0;
    const hashes = new Set(depositRequests.map(hashDepositRequest));
    await sleep(5_000);

    while (ctr < 10 && hashes.size > 0) {
      for (const depositHash of hashes) {
        const status = await queryDepositStatus(depositHash);
        console.log(status);
        if (status && status.status === "Completed") {
          hashes.delete(depositHash);
        }
      }
      await sleep(5_000);
      ctr++;
    }
  }

  return zip(depositRequests, notes);
}

export async function depositFundsSingleToken(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[],
  shouldQueryDepositStatus = true
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

  if (shouldQueryDepositStatus) {
    let ctr = 0;
    const hashes = new Set(depositRequests.map(hashDepositRequest));
    await sleep(5_000);
    while (ctr < 10 && hashes.size > 0) {
      for (const depositHash of hashes) {
        const status = await queryDepositStatus(depositHash);
        console.log(status);
        if (status && status.status === "Completed") {
          hashes.delete(depositHash);
        }
      }
      await sleep(5_000);
      ctr++;
    }
  }

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

  const depositAddr = StealthAddressTrait.compress(stealthAddress);

  const nonce = await depositManager._nonce();
  const instantiateDepositTx = await depositManager
    .connect(eoa)
    .instantiateErc20MultiDeposit(token.address, [value], depositAddr);

  return [
    instantiateDepositTx,
    {
      spender: eoa.address,
      nonce: nonce.toBigInt(),
      encodedAsset: AssetTrait.encode(asset),
      depositAddr,
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
