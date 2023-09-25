import {
  DepositManager,
  SimpleERC20Token,
  WETH9,
} from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  DepositRequest,
  Note,
  StealthAddress,
  StealthAddressTrait,
  hashDepositRequest,
  zip,
} from "@nocturne-xyz/core";
import { ContractTransaction, ethers } from "ethers";
import { queryDepositStatus, sleep } from "./utils";
import { IERC20 } from "@nocturne-xyz/contracts/dist/src/IERC20";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token | WETH9, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  shouldQueryDepositStatus = true
): Promise<[DepositRequest, Note][]> {
  const txs: ContractTransaction[] = [];
  const depositRequests: DepositRequest[] = [];
  const notes: Note[] = [];
  for (const [token, amounts] of tokensWithAmounts) {
    const total = amounts.reduce((sum, a) => sum + a);

    const reserveTx =
      "reserveTokens" in token
        ? await token.reserveTokens(eoa.address, total)
        : await token.connect(eoa).deposit({ value: total });
    txs.push(reserveTx);

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
  token: SimpleERC20Token | WETH9,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[],
  shouldQueryDepositStatus = true
): Promise<[DepositRequest, Note][]> {
  const total = amounts.reduce((sum, a) => sum + a);

  const reserveTx =
    "reserveTokens" in token
      ? await token.reserveTokens(eoa.address, total)
      : await token.connect(eoa).deposit({ value: total });

  const txs = [
    reserveTx,
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
  token: IERC20,
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

  console.log("instantiating deposit...");
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
