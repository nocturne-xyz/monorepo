import { builtinModules } from 'module';
import pkg from './package.json';
import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { cjsToEsm } from '@wessberg/cjs-to-esm-transformer';

export default {
  input: './index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  external: [...builtinModules, ...Object.keys(pkg.dependencies)],
  plugins: [
    typescript({
      transformers: [cjsToEsm()],
      tsconfig: './tsconfig.json',
    }),
    nodePolyfills({
      include: ['../../node_modules/**/*.js'],
    }),
    resolve(),
    json({
      include: ['../../node_modules/**/*.json', '../**/*.json'],
    }),
  ],
};
