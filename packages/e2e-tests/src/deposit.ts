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
import {
  EIP712Domain,
  signDepositRequest,
} from "@nocturne-xyz/deposit-screener";

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

    console.log(
      `Instantiating deposit for ${amount} of token ${token.address}`
    );
    const instantiateDepositTx = await depositManager
      .connect(eoa)
      .instantiateDeposit(depositRequest);
    await instantiateDepositTx.wait(1);

    // TODO: remove self signing once we have real deposit screener agent
    // We currently ensure all EOAs are registered as screeners as temp setup
    const domain: EIP712Domain = {
      name: "NocturneDepositManager",
      version: "v1",
      chainId,
      verifyingContract: depositManager.address,
    };
    const signature = await signDepositRequest(eoa, domain, depositRequest);

    console.log(`Depositing ${amount} of token ${token.address}`);
    const processDepositTx = await depositManager.processDeposit(
      depositRequest,
      signature
    );
    await processDepositTx.wait(1);

    return {
      owner: stealthAddress,
      nonce: BigInt(noteNonce),
      asset,
      value: amount,
    };
  };
}
