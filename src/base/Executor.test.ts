import Executor, { Peer, Manifest, Method, Capabilities } from './Executor'
import DirectServer from '../direct/DirectServer'
import DirectClient from '../direct/DirectClient'
import { ClientType } from './Client'
import { Transport } from './Transports'
import StdioClient from '../stdio/StdioClient'
import { codeChunk, Node, isA, codeExpression, Article } from '@stencila/schema'

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

  test('connect: no addresses', async () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {}
      },
      [DirectClient as ClientType]
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: no client types', async () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {}
      },
      []
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: no addresses match client types', async () => {
    const peer = new Peer(
      {
        capabilities: {},
        addresses: {
          http: {
            type: Transport.http
          }
        }
      },
      [DirectClient as ClientType, StdioClient as ClientType]
    )

    expect(peer.connect()).toBe(false)
  })

  test('connect: order of client types equals preference', async () => {
    const directServer = new DirectServer()
    const manifest: Manifest = {
      capabilities: {},
      addresses: {
        direct: {
          type: Transport.direct,
          server: directServer
        },
        stdio: {
          type: Transport.stdio,
          command: 'echo'
        }
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
    // @ts-ignore
    expect(peer1.interface instanceof DirectClient).toBe(true)

    expect(peer2.connect()).toBe(true)
    // @ts-ignore
    expect(peer2.interface instanceof StdioClient).toBe(true)
  })
})

class DeepThought extends Executor {
  public static readonly question: string =
    'the answer to life the universe and everything'

  public async capabilities(): Promise<Capabilities> {
    return {
      execute: {
        properties: {
          node: {
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
    }
  }

  public async execute(node: Node): Promise<Node> {
    if (isA('CodeChunk', node) && node.text === DeepThought.question) {
      return { ...node, outputs: [42] }
    }
    return node
  }
}

class Calculator extends Executor {
  public async capabilities(): Promise<Capabilities> {
    return {
      execute: {
        properties: {
          node: {
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
    }
  }

  public async execute(node: Node): Promise<Node> {
    if (isA('CodeExpression', node)) {
      // eslint-disable-next-line no-eval
      return { ...node, output: eval(node.text) }
    }
    return node
  }
}

describe('Executor', () => {
  test('peers: in-process', async () => {
    const deepThought = new DeepThought()
    const calculator = new Calculator()

    const manifests: Manifest[] = [
      {
        executor: deepThought,
        capabilities: await deepThought.capabilities()
      },
      {
        executor: calculator,
        capabilities: await calculator.capabilities()
      }
    ]
    const executor = new Executor(manifests)

    // Delegates executable nodes to peers

    expect(await executor.execute(codeChunk(DeepThought.question))).toEqual({
      type: 'CodeChunk',
      text: DeepThought.question,
      outputs: [42]
    })

    expect(await executor.execute(codeExpression('6 * 7'))).toEqual({
      type: 'CodeExpression',
      text: '6 * 7',
      output: 42
    })

    expect(await executor.execute(codeExpression('2 * Math.PI'))).toEqual({
      type: 'CodeExpression',
      text: '2 * Math.PI',
      output: 2 * Math.PI
    })

    // Walks node tree and delegates

    const article = {
      type: 'Article',
      content: [
        {
          type: 'Paragraph',
          content: [
            'Four times twenty one is: ',
            {
              type: 'CodeExpression',
              text: '4 * 21'
            },
            '.'
          ]
        },
        {
          type: 'QuoteBlock',
          content: [
            {
              type: 'Paragraph',
              content: ['The answer is:']
            },
            {
              type: 'CodeChunk',
              text: DeepThought.question
            }
          ]
        }
      ]
    }
    const executed = (await executor.execute(article)) as Article
    expect(executed.type).toEqual('Article')
    // @ts-ignore
    expect(executed.content[0].content[1].output).toEqual(84)
    // @ts-ignore
    expect(executed.content[1].content[1].outputs[0]).toEqual(42)
  })
})
