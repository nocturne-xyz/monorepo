import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetType,
  AssetTrait,
  StealthAddress,
  DepositRequest,
  Note,
} from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import { sleep } from "./utils";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<Note[]> {
  const deposit = await makeDeposit(depositManager, eoa, stealthAddress);
  const notes: Note[] = [];
  for (const [token, amounts] of tokensWithAmounts) {
    const total = amounts.reduce((sum, a) => sum + a);
    {
      const tx = await token.reserveTokens(eoa.address, total);
      await tx.wait(1);
    }
    {
      const tx = await token
        .connect(eoa)
        .approve(depositManager.address, total);
      await tx.wait(1);
    }

    for (const [i, amount] of amounts.entries()) {
      notes.push(await deposit(token, amount, i));
    }
  }

  await sleep(30_000); // wait for deposit screener to complete
  return notes;
}

export async function depositFundsSingleToken(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[]
): Promise<Note[]> {
  const total = amounts.reduce((sum, a) => sum + a);
  {
    const tx = await token.reserveTokens(eoa.address, total);
    await tx.wait(1);
  }
  {
    const tx = await token.connect(eoa).approve(depositManager.address, total);
    await tx.wait(1);
  }

  const deposit = await makeDeposit(depositManager, eoa, stealthAddress);

  const notes: Note[] = [];
  for (const [i, amount] of amounts.entries()) {
    notes.push(await deposit(token, amount, i));
  }

  await sleep(30_000); // wait for deposit screener to complete
  return notes;
}

async function makeDeposit(
  depositManager: DepositManager,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<
  (token: SimpleERC20Token, amount: bigint, noteNonce: number) => Promise<Note>
> {
  const chainId = BigInt(await eoa.getChainId());
  const eoaAddress = await eoa.getAddress();

  return async (token: SimpleERC20Token, amount: bigint, noteNonce: number) => {
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    };
    const encodedAsset = AssetTrait.encode(asset);

    const nonce = await depositManager._nonces(eoaAddress);
    const depositRequest: DepositRequest = {
      chainId,
      spender: eoaAddress,
      encodedAsset,
      value: amount,
      depositAddr: stealthAddress,
      nonce: nonce.toBigInt(),
      gasCompensation: BigInt(0),
    };
    console.log("Deposit request:", depositRequest);

    console.log(
      `Instantiating deposit for ${amount} of token ${token.address}`
    );
    const instantiateDepositTx = await depositManager
      .connect(eoa)
      .instantiateDeposit(depositRequest);
    await instantiateDepositTx.wait(1);

    return {
      owner: stealthAddress,
      nonce: BigInt(noteNonce),
      asset,
      value: amount,
    };
  };
}
