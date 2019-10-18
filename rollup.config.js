import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

const plugins = [
  typescript({
    tsconfig: 'tsconfig.browser.json'
  }),
  commonjs({
    extensions: ['.js', '.ts'],
    namedExports: {
      '@stencila/schema': ['nodeType', 'isPrimitive']
    }
  }),
  json(),
  babel({
    exclude: 'node_modules/**'
  })
]

export default [
  {
    input: 'src/index.ts',
    plugins,
    output: [
      {
        dir: 'dist/lib',
        format: 'cjs'
      },
      {
        dir: 'dist/esm',
        format: 'esm'
      }
    ]
  },
  {
    input: 'src/index.browser.ts',

    plugins: [...plugins, builtins(), resolve()],

    // Do not bundle modules that provide things already
    // in the browser. Put them in `output.globals`
    external: ['cross-fetch', 'isomorphic-ws'],

    output: {
      name: 'executa',
      file: 'dist/browser/index.js',
      format: 'iife',
      globals: {
        'cross-fetch': 'fetch',
        'isomorphic-ws': 'WebSocket'
      }
    }
  }
]
