import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

const entryFiles = [
  './src/base/Executor.ts',
  './src/http/discover.ts',
  './src/ws/WebSocketClient.ts'
]

const plugins = [
  typescript({
    tsconfig: "tsconfig.browser.json",
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

export default entryFiles.reduce(
  (config, entryFile) => [
    ...config,
    {
      input: entryFile,
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
      input: entryFile,
      plugins: [...plugins, builtins(), resolve()],
      output: {
        name: 'executa',
        dir: 'dist/browser',
        format: 'iife'
      }
    }
  ],
  []
)
