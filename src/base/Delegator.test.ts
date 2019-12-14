import * as schema from '@stencila/schema'
import { DirectClient } from '../direct/DirectClient'
import { DirectServer } from '../direct/DirectServer'
import { StdioClient } from '../stdio/StdioClient'
import { Delegator, Peer } from './Delegator'
import { Manifest, Method, Capabilities } from './Executor'
import { DirectAddress } from './Transports'
import { Worker } from './Worker'
import { CapabilityError } from './errors'

describe('Peer', () => {
  test('capable: no capabilities', async () => {
    const peer = new Peer(undefined, [], { version: 1 })

    expect(await peer.capable(Method.compile, { foo: 'bar' })).toBe(false)
    expect(await peer.capable(Method.execute, {})).toBe(false)
  })

  test('capable: boolean capabilities', async () => {
    const peer = new Peer(undefined, [], {
      version: 1,
      capabilities: {
        decode: false,
        compile: true,
        execute: false
      }
    })

    expect(await peer.capable(Method.decode, {})).toBe(false)
    expect(await peer.capable(Method.compile, {})).toBe(true)
    expect(await peer.capable(Method.execute, {})).toBe(false)
  })

  test('capable: schema object capabilities', async () => {
    const peer = new Peer(undefined, [], {
      version: 1,
      capabilities: {
        decode: {
          required: ['content', 'format'],
          properties: {
            content: {
              type: 'string'
            },
            format: {
              enum: ['julia']
            }
          }
        },
        compile: {
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
      addresses: {}
    })

    expect(await peer.capable(Method.decode, {})).toBe(false)
    expect(await peer.capable(Method.decode, { content: 42 })).toBe(false)
    expect(await peer.capable(Method.decode, { content: '42' })).toBe(false)
    expect(
      await peer.capable(Method.decode, { content: '42', format: 'foo' })
    ).toBe(false)
    expect(
      await peer.capable(Method.decode, { content: '42', format: 'julia' })
    ).toBe(true)

    expect(await peer.capable(Method.compile, {})).toBe(false)
    expect(await peer.capable(Method.compile, { node: 42 })).toBe(false)
    expect(
      await peer.capable(Method.compile, { node: { type: 'CodeChunk' } })
    ).toBe(false)
    expect(
      await peer.capable(Method.compile, {
        node: { type: 'CodeChunk', programmingLanguage: 'javascript' }
      })
    ).toBe(false)
    expect(
      await peer.capable(Method.compile, {
        node: { type: 'CodeChunk', programmingLanguage: 'python' }
      })
    ).toBe(true)
    expect(
      await peer.capable(Method.compile, {
        node: { type: 'CodeExpression', programmingLanguage: 'python' }
      })
    ).toBe(true)
  })

  test('capable: multiple capabilities', async () => {
    const peer = new Peer(undefined, [], {
      version: 1,
      capabilities: {
        decode: [
          {
            required: ['content', 'format'],
            properties: {
              content: {
                type: 'string'
              },
              format: {
                enum: ['julia']
              }
            }
          },
          {
            required: ['content', 'format'],
            properties: {
              content: {
                type: 'string'
              },
              format: {
                enum: ['haskell']
              }
            }
          }
        ]
      },
      addresses: {}
    })

    const canDecode = (format: string): Promise<boolean> =>
      peer.capable(Method.decode, { content: 'foo', format })
    expect(await canDecode('julia')).toBe(true)
    expect(await canDecode('haskell')).toBe(true)
    expect(await canDecode('csharp')).toBe(false)
  })

  test('connect: no addresses', async () => {
    const peer = new Peer(undefined, [DirectClient], {
      version: 1,
      capabilities: {},
      addresses: {}
    })

    expect(await peer.connect()).toBe(false)
  })

  test('connect: no client types', async () => {
    const peer = new Peer(undefined, [], {
      version: 1,
      capabilities: {},
      addresses: {}
    })

    expect(await peer.connect()).toBe(false)
  })

  test('connect: no addresses match client types', async () => {
    const peer = new Peer(undefined, [DirectClient, StdioClient], {
      version: 1,
      capabilities: {},
      addresses: {
        http: {
          host: '127.0.0.1',
          port: 8000
        }
      }
    })

    expect(await peer.connect()).toBe(false)
  })

  test('connect: order of client types equals preference', async () => {
    const manifest: Manifest = {
      version: 1,
      capabilities: {},
      addresses: {
        direct: new DirectAddress(new DirectServer()),
        stdio: 'echo'
      }
    }
    const peer1 = new Peer(undefined, [DirectClient, StdioClient], manifest)
    const peer2 = new Peer(undefined, [StdioClient, DirectClient], manifest)

    expect(await peer1.connect()).toBe(true)
    // @ts-ignore that interface is private
    expect(peer1.interface instanceof DirectClient).toBe(true)

    expect(await peer2.connect()).toBe(true)
    // @ts-ignore that interface is private
    expect(peer2.interface instanceof StdioClient).toBe(true)
  })
})

/**
 * An executor class that gives the answer to life.
 */
class DeepThought extends Worker {
  public static readonly question: string =
    'the answer to life the universe and everything'

  public capabilities(): Promise<Capabilities> {
    return Promise.resolve({
      execute: {
        properties: {
          node: {
            type: 'object',
            required: ['type', 'text'],
            properties: {
              type: {
                const: 'CodeChunk'
              },
              text: {
                const: DeepThought.question
              }
            }
          }
        }
      }
    })
  }

  public async execute<Type extends schema.Node>(node: Type): Promise<Type> {
    if (schema.isA('CodeChunk', node) && node.text === DeepThought.question) {
      return Promise.resolve({ ...node, outputs: [42] })
    }
    return Promise.resolve(node)
  }
}

/**
 * An executor class that acts like a simple Javascript calculator.
 */
class Calculator extends Worker {
  public async capabilities(): Promise<Capabilities> {
    return Promise.resolve({
      execute: {
        properties: {
          node: {
            type: 'object',
            required: ['type', 'text'],
            properties: {
              type: {
                const: 'CodeExpression'
              },
              text: {
                type: 'string'
              }
            }
          }
        }
      }
    })
  }

  public async execute<Type extends schema.Node>(node: Type): Promise<Type> {
    if (schema.isA('CodeExpression', node)) {
      // eslint-disable-next-line no-eval
      return Promise.resolve({ ...node, output: eval(node.text) })
    }
    return Promise.resolve(node)
  }
}

describe('Delegator', () => {
  /**
   * Test that delegation, without JSON-RPC or transport layer,
   * works OK.
   */
  test('peers', async () => {
    const deepThought = new DeepThought()
    const calculator = new Calculator()
    const delegator = new Delegator()

    // @ts-ignore that peers are private
    const peersCount = () => Object.keys(delegator.peers).length

    // Can add remove and update peers

    const id1 = delegator.add(deepThought)
    expect(peersCount()).toBe(1)

    const id2 = delegator.add(calculator)
    expect(peersCount()).toBe(2)

    // Delegates executable nodes to peers

    expect(
      await delegator.execute(schema.codeChunk(DeepThought.question))
    ).toEqual({
      type: 'CodeChunk',
      text: DeepThought.question,
      outputs: [42]
    })

    expect(await delegator.execute(schema.codeExpression('6 * 7'))).toEqual({
      type: 'CodeExpression',
      text: '6 * 7',
      output: 42
    })

    expect(
      await delegator.execute(schema.codeExpression('2 * Math.PI'))
    ).toEqual({
      type: 'CodeExpression',
      text: '2 * Math.PI',
      output: 2 * Math.PI
    })

    // Throws a capability error if not able to delegate
    await expect(delegator.execute('a string')).rejects.toThrow(CapabilityError)

    // Throws a capability error if we change a peers capabilities
    delegator.update(id1, { version: 1 })
    await expect(
      delegator.execute(schema.codeChunk(DeepThought.question))
    ).rejects.toThrow(CapabilityError)

    // Throws a capability error if we remove a peer
    delegator.remove(id2)
    await expect(
      delegator.execute(schema.codeExpression('6 * 7'))
    ).rejects.toThrow(CapabilityError)
  })
})
