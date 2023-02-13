import { Vault, Wallet } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  AssetType,
  AssetTrait,
  NoteTrait,
  StealthAddress,
} from "@nocturne-xyz/sdk";
import { ethers } from "ethers";

export async function depositFunds(
  wallet: Wallet,
  vault: Vault,
  token: SimpleERC20Token,
  eoa: ethers.Signer,
  stealthAddress: StealthAddress,
  amounts: bigint[],
  startNonce = 0
): Promise<bigint[]> {
  const eoaAddress = await eoa.getAddress();
  const total = amounts.reduce((sum, a) => sum + a);
  token.reserveTokens(eoaAddress, total);
  await token.connect(eoa).approve(vault.address, total);

  const asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode(asset);

  const commitments: bigint[] = [];
  for (let i = 0; i < amounts.length; i++) {
    console.log(`Depositing ${amounts[i]} of token ${token.address}`);
    const tx = await wallet.connect(eoa).depositFunds({
      spender: eoaAddress,
      encodedAssetAddr,
      encodedAssetId,
      value: amounts[i],
      depositAddr: stealthAddress,
    });
    await tx.wait(1);

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
