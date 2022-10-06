//@ts-ignore
import * as snarkjs from 'snarkjs';

export interface ProofWithPublicSignals {
    proof: {
        pi_a: any;
        pi_b: any;
        pi_c: any;
        protocol: string;
        curve: any;
    };
    publicSignals: any
}

export interface FlaxAddressInput {
	h1X: bigint,
	h1Y: bigint,
	h2X: bigint,
	h2Y: bigint,
	h3X: bigint,
	h3Y: bigint,
}

export interface NoteInput {
	owner: FlaxAddressInput,
	nonce: bigint,
	type: bigint,
	value: bigint,
	id: bigint,
}

export interface MerkleProofInput {
	path: bigint[],
	siblings: bigint[],
}

export interface Spend2Inputs {
	vk: bigint,
	operationDigest: bigint,
	c: bigint,
	z: bigint,
	oldNote: NoteInput,
	newNote: NoteInput,	
	merkleProof: MerkleProofInput,
}

export async function proveSpend2(inputs: Spend2Inputs, _wasmPath?: string, _provingKeyPath?: string): Promise<ProofWithPublicSignals>{
	const { vk, operationDigest, c, z, oldNote, newNote, merkleProof } = inputs;
	const partialWitness = {
		vk,
		c,
		z,
		operationDigest,

		oldNoteOwnerH1X: oldNote.owner.h1X,
		oldNoteOwnerH1Y: oldNote.owner.h1Y,
		oldNoteOwnerH2X: oldNote.owner.h2X,
		oldNoteOwnerH2Y: oldNote.owner.h2Y,
		oldNoteOwnerH3X: oldNote.owner.h3X,
		oldNoteOwnerH3Y: oldNote.owner.h3Y,
		oldNoteNonce: oldNote.nonce,
		oldNoteType: oldNote.type,
		oldNoteId: oldNote.id,
		oldNoteValue: oldNote.value,

		path: merkleProof.path,
		siblings: merkleProof.siblings,

		newNoteOwnerH1X: newNote.owner.h1X,
		newNoteOwnerH1Y: newNote.owner.h1Y,
		newNoteOwnerH2X: newNote.owner.h2X,
		newNoteOwnerH2Y: newNote.owner.h2Y,
		newNoteOwnerH3X: newNote.owner.h3X,
		newNoteOwnerH3Y: newNote.owner.h3Y,
		newNoteNonce: newNote.nonce,
		newNoteType: newNote.type,
		newNoteId: newNote.id,
		newNoteValue: newNote.value
	}

	const wasmPath = _wasmPath || `${__dirname}/../spend2.wasm`;
	const provingKeyPath = _provingKeyPath || `${__dirname}/../spend2_final.zkey`;
	return await snarkjs.groth16.fullProve(partialWitness, wasmPath, provingKeyPath);
}
