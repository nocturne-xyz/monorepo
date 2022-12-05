import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  SNARK_SCALAR_FIELD,
  NocturneAddress,
  NoteTrait,
} from "@nocturne-xyz/sdk";
import { Vault, Wallet } from "@nocturne-xyz/contracts";
import { ethers } from "hardhat";

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

export async function depositFunds(
  wallet: Wallet,
  vault: Vault,
  token: SimpleERC20Token,
  eoa: ethers.Signer,
  nocturneAddress: NocturneAddress,
  amounts: bigint[],
  startNonce = 0
): Promise<bigint[]> {
  token.reserveTokens(eoa.address, 1000);
  await token.connect(eoa).approve(vault.address, 200);

  const commitments = [];
  for (let i = 0; i < amounts.length; i++) {
    await wallet.connect(eoa).depositFunds({
      spender: eoa.address as string,
      asset: token.address,
      value: amounts[i],
      id: ERC20_ID,
      depositAddr: nocturneAddress,
    });

    const note = {
      owner: nocturneAddress,
      nonce: BigInt(i + startNonce),
      asset: token.address,
      id: ERC20_ID,
      value: amounts[i],
    };
    commitments.push(NoteTrait.noteToCommitment(note));
  }

  return commitments;
}
