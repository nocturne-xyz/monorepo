import { asyncExec, PTAU_DIR, CIRCUIT_LOG2_NUM_CONSTRAINTS } from "./util";
import * as fs from 'fs';

async function ptau(log2_size: number) {
	await asyncExec(`yarn snarkjs powersoftau new bn128 ${log2_size} ${PTAU_DIR}/pot${log2_size}_0000.ptau -v`);
	await asyncExec(`yarn snarkjs powersoftau contribute ${PTAU_DIR}/pot${log2_size}_0000.ptau ${PTAU_DIR}/pot${log2_size}_0001.ptau --name=\"First contribution\" -v -e=\"dummy\"`);
	await asyncExec(`yarn snarkjs powersoftau prepare phase2 ${PTAU_DIR}/pot${log2_size}_0001.ptau ${PTAU_DIR}/pot${log2_size}_final.ptau -v`)
}

async function main() {
	if (!fs.existsSync(PTAU_DIR)) {
		fs.mkdirSync(PTAU_DIR)
	}

	await Promise.all(CIRCUIT_LOG2_NUM_CONSTRAINTS.map(log2_size => ptau(log2_size)));
}

main()
