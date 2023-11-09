import * as fs from 'fs';
import * as path from 'path';
import PARAMS from './poseidonBnConstants.json';

const hexToBigintLiteral = (hex: string): string => `${BigInt(hex).toString()}n`;

const convertParams = (index: number): string => {
  return `
    const C = [${
      PARAMS.C[index].map(hexToBigintLiteral).join(', ')
    }];

    const S = [${
      PARAMS.S[index].map(hexToBigintLiteral).join(', ')
    }];

    const M = [${
      PARAMS.M[index].map(row => `[${row.map(hexToBigintLiteral).join(', ')}]`).join(', ')
    }];

    const P = [${
      PARAMS.P[index].map(row => `[${row.map(hexToBigintLiteral).join(', ')}]`).join(', ')
    }];

    export default { C, S, M, P };
  `;
};

// Loop through the range and generate the modules
for (let i = 0; i < 16; i++) {
  const content = convertParams(i);
  fs.writeFileSync(path.join(__dirname, `../src/hashes/constants/constants${i + 1}.ts`), content);
}
