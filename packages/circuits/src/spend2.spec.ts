import { proveSpend2, NoteInput, Spend2Inputs } from "./spend2";


test("it builds properly", async () => {
	const oldNote: NoteInput = {
		owner: {
			h1X: 0n,
			h1Y: 0n,
			h2X: 0n,
			h2Y: 0n,
		},
		nonce: 0n,
		type: 0n,
		value: 0n,
	}

	const newNote: NoteInput = {
		owner: {
			h1X: 0n,
			h1Y: 0n,
			h2X: 0n,
			h2Y: 0n,
		},
		nonce: 0n,
		type: 0n,
		value: 0n,
	}

	const vk = 0n;
	const operationDigest = 0n;
	const c = 0n;
	const z = 0n;

	const merkleProof = {
		path: [0n],
		siblings: [0n],
	}

	const inputs: Spend2Inputs = {
		vk,
		operationDigest,
		c,
		z,
		oldNote,
		newNote,
		merkleProof,
	};

	const isInDist = __dirname.includes("dist") ? true : false;
	console.log("isInDist", isInDist);
	const wasmPath = isInDist ? `${__dirname}/spend2.wasm`: `${__dirname}/../.circom/spend2_js/spend2.wasm`;
	const provingKeyPath = isInDist ? `${__dirname}/spend2_final.zkey`: `${__dirname}/../.setup/spend2_final.zkey`;

	try {
		const proof = await proveSpend2(inputs, wasmPath, provingKeyPath);
		console.log(proof);
	} catch (e) {
		throw e;
	}
});
