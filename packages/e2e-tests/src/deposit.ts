import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { AssetType, AssetTrait, StealthAddress, Note } from "@nocturne-xyz/sdk";
import { ethers, ContractTransaction } from "ethers";
import { sleep } from "./utils";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<Note[]> {
  const deposit = makeDeposit(depositManager, eoa, stealthAddress);
  const notes: Note[] = [];
  const txs: ContractTransaction[] = [];
  for (const [token, amounts] of tokensWithAmounts) {
    const total = amounts.reduce((sum, a) => sum + a);

    txs.push(await token.reserveTokens(eoa.address, total));

    txs.push(await token.connect(eoa).approve(depositManager.address, total));

    for (const [i, amount] of amounts.entries()) {
      const [tx, note] = await deposit(token, amount, i);
      txs.push(tx);
      notes.push(note);
    }
  }

  await Promise.all(txs.map((tx) => tx.wait(1)));
  await sleep(15_000); // wait for deposit screener

  return notes;
}

export async function depositFundsSingleToken(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[]
): Promise<Note[]> {
  const deposit = makeDeposit(depositManager, eoa, stealthAddress);
  const total = amounts.reduce((sum, a) => sum + a);

  const txs = [
    await token.reserveTokens(eoa.address, total),
    await token.connect(eoa).approve(depositManager.address, total),
  ];
  const notes: Note[] = [];

  for (const [i, amount] of amounts.entries()) {
    const [tx, note] = await deposit(token, amount, i);
    txs.push(tx);
    notes.push(note);
  }

  await Promise.all(txs.map((tx) => tx.wait(1)));
  await sleep(15_000); // wait for deposit screener

  return notes;
}

function makeDeposit(
  depositManager: DepositManager,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): (
  token: SimpleERC20Token,
  amount: bigint,
  noteNonce: number
) => Promise<[ContractTransaction, Note]> {
  return async (token: SimpleERC20Token, amount: bigint, noteNonce: number) => {
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    };
    const encodedAsset = AssetTrait.encode(asset);

    console.log(
      `instantiating deposit for ${amount} of token ${token.address}`
    );
    const instantiateDepositTx = await depositManager
      .connect(eoa)
      .instantiateDeposit(encodedAsset, amount, stealthAddress);

    return [
      instantiateDepositTx,
      {
        owner: stealthAddress,
        nonce: BigInt(noteNonce),
        asset,
        value: amount,
      },
    ];
  };
}
