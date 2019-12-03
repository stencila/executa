import { codeChunk, codeExpression, isA, Node } from '@stencila/schema';
import { DirectClient } from '../direct/DirectClient';
import { DirectServer } from '../direct/DirectServer';
import { StdioClient } from '../stdio/StdioClient';
import { ClientType } from './Client';
import { Delegator, Peer } from './Delegator';
import { Capabilities, Manifest, Method } from './Executor';
import { Transport } from './Transports';
import { Worker } from './Worker';
import { CapabilityError } from './CapabilityError';

describe('Peer', () => {
  test('capable: no capabilities', () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {}
      },
      []
    )

    expect(peer.capable(Method.compile, { foo: 'bar' })).toBe(false)
    expect(peer.capable(Method.execute, {})).toBe(false)
  })

  test('capable: boolean capabilities', () => {
    const peer = new Peer(
      {
        capabilities: {
          decode: false,
          compile: true,
          execute: false
        },
        addresses: {}
      },
      []
    )

    expect(peer.capable(Method.decode, {})).toBe(false)
    expect(peer.capable(Method.compile, {})).toBe(true)
    expect(peer.capable(Method.execute, {})).toBe(false)
  })

  test('capable: schema object capabilities', () => {
    const peer = new Peer(
      {
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
      },
      []
    )

    expect(peer.capable(Method.decode, {})).toBe(false)
    expect(peer.capable(Method.decode, { content: 42 })).toBe(false)
    expect(peer.capable(Method.decode, { content: '42' })).toBe(false)
    expect(peer.capable(Method.decode, { content: '42', format: 'foo' })).toBe(
      false
    )
    expect(
      peer.capable(Method.decode, { content: '42', format: 'julia' })
    ).toBe(true)

    expect(peer.capable(Method.compile, {})).toBe(false)
    expect(peer.capable(Method.compile, { node: 42 })).toBe(false)
    expect(peer.capable(Method.compile, { node: { type: 'CodeChunk' } })).toBe(
      false
    )
    expect(
      peer.capable(Method.compile, {
        node: { type: 'CodeChunk', programmingLanguage: 'javascript' }
      })
    ).toBe(false)
    expect(
      peer.capable(Method.compile, {
        node: { type: 'CodeChunk', programmingLanguage: 'python' }
      })
    ).toBe(true)
    expect(
      peer.capable(Method.compile, {
        node: { type: 'CodeExpression', programmingLanguage: 'python' }
      })
    ).toBe(true)
  })

  test('capable: multiple capabilities', () => {
    const peer = new Peer(
      {
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
      },
      []
    )

    const canDecode = (format: string): boolean =>
      peer.capable(Method.decode, { content: 'foo', format })
    expect(canDecode('julia')).toBe(true)
    expect(canDecode('haskell')).toBe(true)
    expect(canDecode('csharp')).toBe(false)
  })

  test('connect: no addresses', () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {}
      },
      [DirectClient as ClientType]
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: no client types', () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {}
      },
      []
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: no addresses match client types', () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {
          http: {
            host: '127.0.0.1',
            port: 8000
          }
        }
      },
      [DirectClient as ClientType, StdioClient as ClientType]
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: order of client types equals preference', () => {
    const directServer = new DirectServer()
    const manifest: Manifest = {
      capabilities: {},
      addresses: {
        direct: {
          type: Transport.direct,
          server: directServer
        },
        stdio: 'echo'
      }
    }
    const peer1 = new Peer(manifest, [
      DirectClient as ClientType,
      StdioClient as ClientType
    ])
    const peer2 = new Peer(manifest, [
      StdioClient as ClientType,
      DirectClient as ClientType
    ])

    expect(peer1.connect()).toBe(true)
    // @ts-ignore that executor is private
    expect(peer1.executor instanceof DirectClient).toBe(true)

    expect(peer2.connect()).toBe(true)
    // @ts-ignore that executor is private
    expect(peer2.executor instanceof StdioClient).toBe(true)
  })
})

/**
 * An executor class that gives the answer to life.
 */
class DeepThought extends Worker {
  public static readonly question: string =
    'the answer to life the universe and everything'

  public async capabilities(): Promise<Capabilities> {
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

  public async execute<NodeType extends Node>(
    node: NodeType
  ): Promise<NodeType> {
    if (isA('CodeChunk', node) && node.text === DeepThought.question) {
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

  public async execute<NodeType extends Node>(
    node: NodeType
  ): Promise<NodeType> {
    if (isA('CodeExpression', node)) {
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
  test('peers: in-process', async () => {
    const deepThought = new DeepThought()
    const calculator = new Calculator()

    const delegator = new Delegator([], {
        deepThought: {
          id: deepThought,
          capabilities: await deepThought.capabilities()
        },})

    // @ts-ignore that peers are private
    const peersCount = () => Object.keys(delegator.peers).length

    // Can add remove and update peers

    expect(peersCount()).toBe(1)

    delegator.add('calculator', {})
    expect(peersCount()).toBe(2)

    delegator.remove('calculator')
    expect(peersCount()).toBe(1)

    delegator.update('calculator',{
      id: calculator,
      capabilities: await calculator.capabilities()
    })
    expect(peersCount()).toBe(2)

    // Delegates executable nodes to peers

    expect(await delegator.execute(codeChunk(DeepThought.question))).toEqual({
      type: 'CodeChunk',
      text: DeepThought.question,
      outputs: [42]
    })

    expect(await delegator.execute(codeExpression('6 * 7'))).toEqual({
      type: 'CodeExpression',
      text: '6 * 7',
      output: 42
    })

    expect(await delegator.execute(codeExpression('2 * Math.PI'))).toEqual({
      type: 'CodeExpression',
      text: '2 * Math.PI',
      output: 2 * Math.PI
    })

    // Throws a capability error if not able to delegate
    await expect(delegator.execute('a string')).rejects.toThrow(CapabilityError)
  })

  /**
   * Test that delegation via JSON-RPC, but no transport layer,
   * works OK.
   */
  test('peers: direct', async () => {
    const deepThought = new DeepThought()
    const deepThoughtServer = new DirectServer()
    await deepThoughtServer.start(deepThought)

    const calculator = new Calculator()
    const calculatorServer = new DirectServer()
    await calculatorServer.start(calculator)

    const executor = new Delegator(
      [DirectClient as ClientType],
      {
        deepThought: {
            addresses: {
              direct: {
                type: Transport.direct,
                server: deepThoughtServer
              }
            },
            capabilities: await deepThought.capabilities()
          },
          calculator: {
            addresses: {
              direct: {
                type: Transport.direct,
                server: calculatorServer
              }
            },
            capabilities: await calculator.capabilities()
          }
      }
    )

    expect(await executor.execute(codeChunk(DeepThought.question))).toEqual({
      type: 'CodeChunk',
      text: DeepThought.question,
      outputs: [42]
    })

    expect(await executor.execute(codeExpression('1 + 2 + 3 * 5'))).toEqual({
      type: 'CodeExpression',
      text: '1 + 2 + 3 * 5',
      output: 18
    })
  })
})
