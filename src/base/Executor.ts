import { Node } from '@stencila/schema'
import Client from './Client'

/**
 * The methods of an `Executor` class.
 */
export enum Method {
  capabilities = 'capabilities',
  decode = 'decode',
  encode = 'encode',
  compile = 'compile',
  build = 'build',
  execute = 'execute'
}

/**
 * The capabilities of an `Executor` class as
 * a mapping of method name to a JSON Schema object
 * specifying constraints for parameters.
 */
export type Capabilities = { [key in Method]: any }

/**
 * Interface for `Executor` classes and their proxies.
 */
export abstract class Interface {
  /**
   * Get the capabilities of the executor
   *
   * @see Capabilities
   */
  abstract async capabilities(): Promise<Capabilities>

  /**
   * Decode content to a `Node`.
   *
   * @param content The content to decode
   * @param format The format of the content
   * @returns The decoded node
   */
  abstract async decode(content: string, format?: string): Promise<Node>

  /**
   * Encode a `Node` in a format.
   *
   * @param node The node to encode
   * @param format The format to encode
   * @returns The node encoded in the format
   */
  abstract async encode(node: Node, format?: string): Promise<Node>

  /**
   * Compile a `Node`.
   *
   * @param node The node to compile
   * @returns The compiled node
   */
  abstract async compile(node: Node): Promise<Node>

  /**
   * Build a `Node`.
   *
   * @param node The node to build
   * @returns The build node
   */
  abstract async build(node: Node): Promise<Node>

  /**
   * Execute a `Node`.
   *
   * @param node The node to execute
   * @returns The executed node
   */
  abstract async execute(node: Node): Promise<Node>
}

class Peer {
  /**
   * The client used to delegate to the peer.
   */
  public readonly client: Client

  /**
   * The capabilities of the peer.
   */
  private capabilities?: Capabilities

  /**
   * Ajv validation functions for each method .
   */
  private validators?: { [key in Method]: unknown }

  public constructor(client: Client) {
    this.client = client
    // TODO: initialise capabilities and validators
  }

  /**
   * Test whether the peer is capable of performing the
   * method with the parameters.
   *
   * @param method The method to be called
   * @param params The parameter values of the call
   */
  public capable(method: Method, params: { [key: string]: unknown }): boolean {
    // TODO: Test capability using validator for the method
    return this.client.capable(method, params)
    //return true
  }
}

/**
 * A base `Executor` class implementation.
 *
 * This executor class has limited capabilities itself and
 * instead, mostly delegates to other executors. If unable
 * to delegate to a peer, then falls back to returning
 * the `Node` unchanged (for `compile`, `build` etc) or
 * attempting to use JSON as format (for `decode` and `encode`).
 */
export default class Executor implements Interface {
  /**
   * Peer executors that are delegated to depending
   * upon their capabilities and the request at hand.
   */
  private peers: Peer[]

  public constructor(peers: Client[] = []) {
    this.peers = peers.map(peer => new Peer(peer))
  }

  /**
   * Get the capabilities of the executor
   */
  public async capabilities(): Promise<Capabilities> {
    return {
      capabilities: true,
      decode: {
        properties: {
          content: { type: 'string' },
          format: { enum: ['json'] }
        },
        required: ['content']
      },
      encode: {
        properties: {
          node: true,
          format: { enum: ['json'] }
        },
        required: ['node']
      },
      compile: false,
      build: false,
      execute: false
    }
  }

  public async decode(content: string, format: string = 'json'): Promise<Node> {
    if (format === 'json') return JSON.parse(content)
    return this.delegate(Method.decode, { content, format }, () =>
      this.decode(content, 'json')
    )
  }

  public async encode(node: Node, format: string = 'json'): Promise<string> {
    if (format === 'json') return JSON.stringify(node)
    return this.delegate(Method.encode, { node, format }, () =>
      this.encode(node, 'json')
    )
  }

  public async compile(node: Node): Promise<Node> {
    return this.delegate(Method.compile, { node }, async () => node)
  }

  public async build(node: Node): Promise<Node> {
    return this.delegate(Method.build, { node }, async () => node)
  }

  public async execute(node: Node): Promise<Node> {
    return this.delegate(Method.execute, { node }, async () => node)
  }

  private async delegate<Type>(
    method: Method,
    params: { [key: string]: any },
    fallback: () => Promise<Type>
  ): Promise<Type> {
    // Attempt to delegate to a peer
    for (const peer of this.peers) {
      if (peer.capable(method, params)) {
        return peer.client.call<Type>(method, params)
      }
    }
    // No peer has necessary capability so resort to fallback
    return fallback()
  }
}
