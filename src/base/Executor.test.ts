import Executor, { Peer, Manifest, Method } from './Executor'
import DirectServer from '../direct/DirectServer'
import DirectClient from '../direct/DirectClient'
import { ClientType } from './Client'
import { Transport } from './Transports'
import StdioClient from '../stdio/StdioClient'

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

  test('capable: boolean capabilties', () => {
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

  test('capable: schema object capabilties', () => {
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
    expect(peer1.client instanceof DirectClient).toBe(true)

    expect(peer2.connect()).toBe(true)
    // @ts-ignore
    expect(peer2.client instanceof StdioClient).toBe(true)
  })
})
