import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";
import { SNARK_SCALAR_FIELD, FlaxAddress, Note } from "@flax/sdk";
import { Vault, Wallet } from "@flax/contracts";
import { ethers } from "hardhat";

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

export async function depositFunds(wallet: Wallet, vault: Vault, token: SimpleERC20Token, eoa: ethers.Signer, flaxAddress: FlaxAddress, amounts: bigint[], startNonce = 0): Promise<bigint[]> {
	token.reserveTokens(eoa.address, 1000);
	await token.connect(eoa).approve(vault.address, 200);

	const commitments = [];
	for (let i = 0; i < amounts.length; i++) {
		await wallet.connect(eoa).depositFunds({
			spender: eoa.address as string,
			asset: token.address,
			value: amounts[i],
			id: ERC20_ID,
			depositAddr: flaxAddress.toStruct(),
		});

		const owner = flaxAddress.toStruct();
		const noteStruct = {
			owner,
			nonce: BigInt(i + startNonce),
			asset: token.address,
			id: ERC20_ID,
			value: amounts[i],
		}
		const note = new Note(noteStruct)
		commitments.push(note.toCommitment());
	}

	return commitments;
}
