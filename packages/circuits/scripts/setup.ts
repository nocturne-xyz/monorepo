import { asyncExec, CIRCOM_OUTPUT_DIR, PTAU_DIR, SETUP_DIR, CIRCUIT_NAMES, CIRCUIT_LOG2_NUM_CONSTRAINTS } from "./util";
import * as fs from 'fs';

async function setup(circuitName: string, log2_size: number) {
	await asyncExec(`yarn snarkjs groth16 setup ${CIRCOM_OUTPUT_DIR}/${circuitName}.r1cs ${PTAU_DIR}/pot${log2_size}_final.ptau ${SETUP_DIR}/${circuitName}_0000.zkey`)
	await asyncExec(`yarn snarkjs zkey contribute ${SETUP_DIR}/${circuitName}_0000.zkey ${SETUP_DIR}/${circuitName}_final.zkey --name=\"first contribution\" -v -e=\"dummy\"`)
	await asyncExec(`yarn snarkjs zkey verify ${CIRCOM_OUTPUT_DIR}/${circuitName}.r1cs ${PTAU_DIR}/pot${log2_size}_final.ptau ${SETUP_DIR}/${circuitName}_final.zkey`);
	await asyncExec(`yarn snarkjs zkey export verificationkey ${SETUP_DIR}/${circuitName}_final.zkey ${SETUP_DIR}/${circuitName}_verification_key.json`)
}

async function main() {
	if (!fs.existsSync(SETUP_DIR)) {
		fs.mkdirSync(SETUP_DIR)
	}

	await Promise.all(CIRCUIT_NAMES.map((circuitName, i) => setup(circuitName, CIRCUIT_LOG2_NUM_CONSTRAINTS[i])));
}

main()
