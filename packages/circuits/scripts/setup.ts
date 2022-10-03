import { asyncExec, CIRCOM_OUTPUT_DIR, PTAU_DIR, SETUP_DIR, CIRCUIT_NAMES, CIRCUIT_LOG2_NUM_CONSTRAINTS } from "./util";
import * as fs from 'fs';

async function setup(circuitName: string, log2_size: number) {
	await asyncExec(`yarn snarkjs powersoftau prepare phase2 ${PTAU_DIR}/pot${log2_size}_0001.ptau ${SETUP_DIR}/pot${log2_size}_${circuitName}_final.ptau -v`)
	await asyncExec(`yarn snarkjs groth16 setup ${CIRCOM_OUTPUT_DIR}/${circuitName}.r1cs ${SETUP_DIR}/pot${log2_size}_${circuitName}_final.ptau ${SETUP_DIR}/${circuitName}_0000.zkey`)
	await asyncExec(`yarn snarkjs zkey contribute ${SETUP_DIR}/${circuitName}_0000.zkey ${SETUP_DIR}/${circuitName}_0001.zkey --name=\"Second contribution\" -v -e=\"dummy\"`)
	await asyncExec(`yarn snarkjs zkey export verificationkey ${SETUP_DIR}/${circuitName}_0001.zkey ${SETUP_DIR}/${circuitName}_proof_key.json`)
}

async function main() {
	if (!fs.existsSync(SETUP_DIR)) {
		fs.mkdirSync(SETUP_DIR)
	}

	await Promise.all(CIRCUIT_NAMES.map((circuitName, i) => setup(circuitName, CIRCUIT_LOG2_NUM_CONSTRAINTS[i])));
}

main()
