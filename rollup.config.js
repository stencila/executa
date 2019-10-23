import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import builtins from 'rollup-plugin-node-builtins'
import resolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

export default [
  {
    input: 'src/index.browser.ts',

    plugins: [
      typescript({
        tsconfig: 'tsconfig.browser.json'
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        namedExports: {
          '@stencila/schema': [
            'nodeType',
            'isPrimitive',
            'codeChunk',
            'environment',
            'softwareSession'
          ]
        }
      }),
      json(),
      babel({
        exclude: 'node_modules/**'
      }),
      builtins(),
      resolve()
    ],

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
