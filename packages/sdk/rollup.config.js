import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: './index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [
    typescript({
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
    nodePolyfills({
      include: ['../../node_modules/**/*.js'],
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
    resolve({
      include: ['../../node_modules/**/*.js'],
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
    commonjs({
      exclude: ['../../node_modules/@ethersproject/**/*.js'],
    }),
    json({
      include: ['../../node_modules/**/*.json', '../**/*.json'],
      exclude: ['../../node_modules/@ethersproject/**'],
    }),
  ],
};
