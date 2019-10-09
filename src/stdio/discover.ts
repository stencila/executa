import { Manifest } from '../base/Executor'
import { Transport } from '../base/Transports'

export default function discover(): Manifest[] {
  // TODO: implement discovery of manifest files from ~/.stencila/executors/ (or similar)
  // Should be able to mostly copy and paste from
  //   https://github.com/stencila/node/blob/24c30d1c89b5f6b6719a0beeda7a55d19401c294/lib/host/Host.js#L654-L666
  // See https://github.com/stencila/executa/issues/2
  return [python, js]
}

// These are just stubs to be replaced by JSON read in from manifest.json files...

const python: Manifest = {
  capabilities: {
    execute: {
      type: 'object',
      required: ['node'],
      properties: {
        node: {
          type: 'object',
          required: ['type', 'programmingLanguage'],
          properties: {
            type: {
              enum: ['CodeChunk', 'CodeExpression']
            },
            programmingLanguage: {
              enum: ['python']
            }
          }
        }
      }
    }
  },
  addresses: {
    stdio: {
      type: Transport.stdio,
      command: 'python3',
      args: ['-m', 'stencila.schema', 'listen']
    }
  }
}

const js: Manifest = {
  capabilities: {
    execute: {
      type: 'object',
      required: ['node'],
      properties: {
        node: {
          type: 'object',
          required: ['type', 'programmingLanguage'],
          properties: {
            type: {
              enum: ['CodeChunk', 'CodeExpression']
            },
            programmingLanguage: {
              enum: ['javascript']
            }
          }
        }
      }
    }
  },
  addresses: {
    stdio: {
      type: Transport.stdio,
      command: 'npx',
      args: [
        'ts-node',
        '/Users/ben/Documents/stencila/schema/ts/interpreter',
        'listen'
      ],
      cwd: '/Users/ben/Documents/stencila/schema'
    }
  }
}
