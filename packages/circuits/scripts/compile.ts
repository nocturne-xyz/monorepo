import { asyncExec, CIRCUIT_DIR, CIRCOM_OUTPUT_DIR, CIRCUIT_NAMES } from "./util";
import * as fs from "fs";

async function compile(circuitName: string) {
	await asyncExec(`circom ${CIRCUIT_DIR}/${circuitName}.circom --r1cs --wasm -o \"${CIRCOM_OUTPUT_DIR}\"`)
}

async function main() {
	if (!fs.existsSync(CIRCOM_OUTPUT_DIR)) {
		fs.mkdirSync(CIRCOM_OUTPUT_DIR)
	}
	
	await Promise.all(CIRCUIT_NAMES.map(circuitName => compile(circuitName)));
}

main()
