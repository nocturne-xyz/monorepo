import * as md5 from "js-md5"

export const asyncExec = command => new Promise((resolve, reject) => {
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

export const fileExists = (fileName: string): Promise<string>  => {
	return new Promise((res, rej) => {
		fs.exists(fileName, (exists) => res(exists));
	})
}

export const readFileHex = (fileName: string): Promise<string> => {
	return new Promise((res, rej) => {
		fs.readFile(fileName, (data, err) => {
			if (err) {
				rej(err);
			} else {
				res(data.toString('hex'));
			}
		});
	});
}

export const fileIsSame = async (fileName: string): Promise<boolean> => {
	if (!(await fileExists(fileName))) {
		return false
	}

	if (!(await fileExists(`${fileName}.md5`))) {
		return false
	}

	let old_checksum = await readFileHex(`${fileName}.md5`);
	let curr_file = await readFileHex(filename);
	let checksum = md5(curr_file);
	
	return checksum == old_checksum
}

