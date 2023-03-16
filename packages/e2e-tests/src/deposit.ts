import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetType,
  AssetTrait,
  NoteTrait,
  StealthAddress,
  DepositRequest,
} from "@nocturne-xyz/sdk";
import { signDepositRequest } from "@nocturne-xyz/deposit-screener";
import { ethers } from "ethers";
import { EIP712Domain } from "@nocturne-xyz/deposit-screener/dist/src/typedData";

export async function depositFunds(
  depositManager: DepositManager,
  token: SimpleERC20Token,
  eoa: ethers.Wallet,
  stealthAddress: StealthAddress,
  amounts: bigint[],
  startNonce = 0
): Promise<bigint[]> {
  const eoaAddress = await eoa.getAddress();
  const chainId = BigInt(await eoa.getChainId());
  const total = amounts.reduce((sum, a) => sum + a);
  {
    const tx = await token.reserveTokens(eoaAddress, total);
    await tx.wait(1);
  }
  {
    const tx = await token.connect(eoa).approve(depositManager.address, total);
    await tx.wait(1);
  }

  const asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  const encodedAsset = AssetTrait.encode(asset);

  const commitments: bigint[] = [];
  for (let i = 0; i < amounts.length; i++) {
    const nonce = await depositManager._nonces(eoaAddress);
    const depositRequest: DepositRequest = {
      chainId,
      spender: eoaAddress,
      encodedAsset,
      value: amounts[i],
      depositAddr: stealthAddress,
      nonce: nonce.toBigInt(),
      gasCompensation: BigInt(0),
    };

    console.log(
      `Instantiating deposit for ${amounts[i]} of token ${token.address}`
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

    console.log(`Depositing ${amounts[i]} of token ${token.address}`);
    const processDepositTx = await depositManager.processDeposit(
      depositRequest,
      signature
    );
    await processDepositTx.wait(1);

    const note = {
      owner: stealthAddress,
      nonce: BigInt(i + startNonce),
      asset,
      value: amounts[i],
    };
    commitments.push(NoteTrait.toCommitment(note));
  }

  return commitments;
}
