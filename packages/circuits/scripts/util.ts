import { spawn } from "child_process";
import * as fs from "fs";

export const CIRCUIT_DIR = `${__dirname}/../circuits`;
export const CIRCOM_OUTPUT_DIR = `${__dirname}/../.circom`;
export const PTAU_DIR = `${__dirname}/../.ptau`;
export const SETUP_DIR = `${__dirname}/../.setup`;

export const CIRCUIT_NAMES = [
	"spend",
	// "send2",
];

export const asyncExec = (command: string) => new Promise((resolve, reject) => {
	let stdout = '';
	let stderr = '';
	const child = spawn('sh', ['-c', command]);
	child.stdout.on('data', data => {
		const output = data.toString();
		console.log(output);
		stdout += output;
	});
	child.stderr.on('data', data => {
		const output = data.toString();
		console.error(output);
		stderr += output;
	});
	child.on('error', reject);
	child.on('exit', () => resolve([stdout, stderr]));
});

export const fileExists = (fileName: string): Promise<boolean>  => {
	return new Promise((res, rej) => {
		fs.exists(fileName, (exists) => res(exists));
	})
}
