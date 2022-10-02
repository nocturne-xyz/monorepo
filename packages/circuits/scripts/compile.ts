import { asyncExec, fileIsSame } from "./util";
import * as fs from "fs";
import { spawn } from "child_process";

const OUTPUT_DIR = `${__dirname}/../.output`;
const CIRCUIT_DIR = `${__dirname}/../circuits`;
const CIRCUIT_NAMES = [
	"note",
	"note2",
	"sig",
	"spend",
	"send2",
	"tree"
];

async function compile(circuitName: string, force: boolean) {
	// only compile if it hasn't been done yet
	if (force || !(await fileIsSame(`${CIRCUIT_DIR}/${circuitName}.circom`))) {
		console.log(`\x1b[32m Compiling circuit \"${circuitName}\"... \x1b[0m`);
		const startTime = performance.now()

		await asyncExec(`circom ${CIRCUIT_DIR}/${circuitName}.circom --r1cs --wasm -o \"${OUTPUT_DIR}\"`)
		const endTime = performance.now()
		console.log(`Compilation took ${endTime - startTime} milliseconds`)
	} else {
		console.log(`circuit ${circuitName} hasn't changed - skipping...`)
	}
}

async function main() {
	if (!fs.existsSync(`${__dirname}/../.output`)) {
		fs.mkdirSync(`${__dirname}/../.output`)
	}

	await Promise.all(CIRCUIT_NAMES.map(circuitName => compile(circuitName, false)));
}

main()
