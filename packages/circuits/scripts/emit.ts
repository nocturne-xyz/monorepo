import { CIRCUIT_NAMES, SETUP_DIR, DIST_DIR, CIRCOM_OUTPUT_DIR } from "./util";
import * as fs from "fs";

async function main() {
	if (!fs.existsSync(DIST_DIR)) {
		throw new Error("tsc must be run before this script");
	}

	const proms = CIRCUIT_NAMES.flatMap(async (circuitName) => {
		[
			fs.promises.copyFile(`${CIRCOM_OUTPUT_DIR}/${circuitName}_js/${circuitName}.wasm`, `${DIST_DIR}/${circuitName}.wasm`),
			fs.promises.copyFile(`${SETUP_DIR}/${circuitName}_final.zkey`, `${DIST_DIR}/${circuitName}_final.zkey`),
		]
	});

	await Promise.all(proms)
}

main()
