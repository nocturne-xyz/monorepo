import { builtinModules } from 'module';
import pkg from './package.json';
import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import legacy from '@rollup/plugin-legacy';
import { cjsToEsm } from '@wessberg/cjs-to-esm-transformer';

export default {
  input: './index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  external: [...builtinModules, ...Object.keys(pkg.devDependencies)],
  plugins: [
    typescript({
      transformers: [cjsToEsm()],
      tsconfig: './tsconfig.json',
    }),
    nodePolyfills({
      include: ['../../node_modules/**/*.js'],
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
    resolve({
      modulesOnly: true,
    }),
    // commonjs({
    //   exclude: ['../../node_modules/@ethersproject/**/*.js'],
    //   defaultIsModuleExports: 'auto',
    //   requireReturnsDefault: 'auto',
    // }),
    json({
      include: ['../../node_modules/**/*.json', '../**/*.json'],
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
  ],
};
