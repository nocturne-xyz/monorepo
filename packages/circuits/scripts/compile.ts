import { asyncExec, fileExists, CIRCUIT_DIR, CIRCOM_OUTPUT_DIR, CIRCUIT_NAMES } from "./util";
import * as fs from "fs";


async function compile(circuitName: string) {
	console.log(`\x1b[32m Compiling circuit \"${circuitName}\"... \x1b[0m`);
	const startTime = performance.now()

	await asyncExec(`circom ${CIRCUIT_DIR}/${circuitName}.circom --r1cs --wasm -o \"${CIRCOM_OUTPUT_DIR}\"`)
	const endTime = performance.now()
	console.log(`Compilation took ${endTime - startTime} milliseconds`)
}

async function main() {
	if (!(await fileExists(CIRCOM_OUTPUT_DIR))) {
		fs.mkdirSync(CIRCOM_OUTPUT_DIR)
	}
	
	await Promise.all(CIRCUIT_NAMES.map(circuitName => compile(circuitName)));
}

main()
