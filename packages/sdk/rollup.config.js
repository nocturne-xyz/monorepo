import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
  input: './index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [typescript(), nodePolyfills()],
};
