import alias from '@rollup/plugin-alias'
import replace from '@rollup/plugin-replace'
import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import hashbang from 'rollup-plugin-hashbang'
import json from 'rollup-plugin-json'
import builtins from 'rollup-plugin-node-builtins'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import typescript from 'rollup-plugin-typescript2'
import nodeBuiltins from 'builtin-modules'

import pkg from './package.json'

const plugins = (options, before = [], after = []) => [
  ...before,
  hashbang(),
  resolve({
    mainFields: ['module', 'jsnext', 'main'],
    browser: options.target === 'browser',
    preferBuiltins: options.target === 'node' ? true : false,
    modulesOnly: options.target !== 'browser',
  }),
  commonjs({
    namedExports: {
      '@stencila/configa': ['collectConfig', 'helpUsage'],
    },
  }),
  json(),
  typescript({
    tsconfig: `tsconfig${options.target === 'browser' ? '.browser' : ''}.json`,
  }),
  babel({
    exclude: 'node_modules/**',
  }),
  ...after,
]

const minify = terser({
  output: { comments: false },
  compress: {
    keep_infinity: true,
    pure_getters: true,
    passes: 10,
  },
  ecma: 5,
  warnings: true,
})

// The ESM and CJS builds are defined as separate configurations due to differences in the plugins.
// The ESM builds are not minified, nor environment variables inlined, as they will be processed
// by the consuming project compilers.
export default [
  {
    input: 'src/index.ts',
    treeshake: {
      propertyReadSideEffects: false,
    },
    plugins: plugins(
      { target: 'node' },
      [
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
      ],
      [minify]
    ),
    external: [...nodeBuiltins, ...Object.keys(pkg.dependencies)],
    output: [
      {
        file: pkg.main,
        sourcemap: true,
        format: 'cjs',
      },
    ],
  },
  {
    input: 'src/index.ts',
    treeshake: {
      propertyReadSideEffects: false,
    },
    plugins: plugins({ target: 'node' }),
    external: [...nodeBuiltins, ...Object.keys(pkg.dependencies)],
    output: [
      {
        file: pkg.module,
        sourcemap: true,
        format: 'esm',
      },
    ],
  },
  {
    input: 'src/index.browser.ts',
    treeshake: {
      propertyReadSideEffects: false,
    },
    plugins: plugins(
      { target: 'browser' },
      [
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        alias({
          entries: [
            { find: 'cross-fetch', replacement: 'fetch' },
            { find: 'isomorphic-ws', replacement: 'WebSocket' },
          ],
        }),
      ],
      [builtins(), minify]
    ),
    // Do not bundle modules that provide things already
    // in the browser. Put them in `output.globals`
    external: ['cross-fetch', 'isomorphic-ws', '@stencila/configa'],
    output: [
      {
        name: 'executa',
        file: pkg.unpkg,
        format: 'umd',
        extend: true,
        sourcemap: true,
        globals: {
          'cross-fetch': 'fetch',
          'isomorphic-ws': 'WebSocket',
        },
      },
    ],
  },
  {
    input: 'src/index.browser.ts',
    treeshake: {
      propertyReadSideEffects: false,
    },
    plugins: plugins(
      { target: 'browser' },
      [
        alias({
          entries: [
            { find: 'cross-fetch', replacement: 'fetch' },
            { find: 'isomorphic-ws', replacement: 'WebSocket' },
          ],
        }),
      ],
      [builtins()]
    ),
    // Do not bundle modules that provide things already
    // in the browser. Put them in `output.globals`
    external: ['cross-fetch', 'isomorphic-ws', '@stencila/configa'],
    output: [
      {
        file: pkg.browser,
        sourcemap: true,
        format: 'esm',
      },
    ],
  },
]
