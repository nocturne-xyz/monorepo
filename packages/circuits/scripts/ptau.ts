import { asyncExec } from "./util";
import { v4 } from 'uuid';

async function ptau(log2_size: number) {
	await asyncExec(`snarkjs powersoftau new bn128 ${log2_size} ${__dirname}/.output/pot${log2_size}_0000.ptau -v`)
	await asyncExec(`snarkjs powersoftau contribute ${__dirname}/.output/pot${log2_size}_0000.ptau ${__dirname}/.output/pot${log2_size}_0001.ptau --name=\"First contribution\" -v -e=\"${v4()}\"`)	
}
