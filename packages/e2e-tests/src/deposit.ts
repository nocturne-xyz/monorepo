import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetType,
  AssetTrait,
  StealthAddress,
  DepositRequest,
} from "@nocturne-xyz/sdk";
import { signDepositRequest } from "@nocturne-xyz/deposit-screener";
import { ethers } from "ethers";
import { EIP712Domain } from "@nocturne-xyz/deposit-screener/dist/src/typedData";

export async function depositFundsMultiToken(
  depositManager: DepositManager,
  tokensWithAmounts: [SimpleERC20Token, bigint[]][],
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<void> {
  const deposit = await makeDeposit(depositManager, eoa, stealthAddress);
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

    for (const amount of amounts) {
      await deposit(token, amount);
    }
  }
}

export async function depositFundsSingleToken(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[]
): Promise<void> {
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
  for (const amount of amounts) {
    await deposit(token, amount);
  }
}

async function makeDeposit(
  depositManager: DepositManager,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress
): Promise<(token: SimpleERC20Token, amount: bigint) => Promise<void>> {
  const chainId = BigInt(await eoa.getChainId());
  const eoaAddress = await eoa.getAddress();

  return async (token: SimpleERC20Token, amount: bigint) => {
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
  };
}
