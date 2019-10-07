import {Node} from '@stencila/schema'

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
export type Capabilities = {[key in Method]: any}

/**
 * Interface for `Executor` classes and their proxies.
 */
export abstract class Interface {

  /**
   * Get the capabilities of the executor
   *
   * @see Capabilities
   */
  abstract async capabilities (): Promise<Capabilities>

  /**
   * Decode content to a `Node`.
   *
   * @param content The content to decode
   * @param format The format of the content
   * @returns The decoded node
   */
  abstract async decode (content: string, format?: string): Promise<Node>

  /**
   * Encode a `Node` in a format.
   *
   * @param node The node to encode
   * @param format The format to encode
   * @returns The node encoded in the format
   */
  abstract async encode (node: Node, format?: string): Promise<Node>

  /**
   * Compile a `Node`.
   *
   * @param node The node to compile
   * @returns The compiled node
   */
  abstract async compile (node: Node): Promise<Node>

  /**
   * Build a `Node`.
   *
   * @param node The node to build
   * @returns The build node
   */
  abstract async build (node: Node): Promise<Node>

  /**
   * Execute a `Node`.
   *
   * @param node The node to execute
   * @returns The executed node
   */
  abstract async execute (node: Node): Promise<Node>
}


/**
 * A base `Executor` class implementation.
 *
 * This executor class has limited capabilities itself and
 * instead, mostly delegates to other executors.
 */
export default class Executor implements Interface {

  /**
   * Peer executors that are delegated to depending
   * upon their capabilities and the request at hand.
   */
  peers: Interface[]

  constructor (peers: Interface[] = []) {
    this.peers = peers
  }

  /**
   * Get the capabilities of the executor
   */
  async capabilities (): Promise<Capabilities> {
    return {
      capabilities: true,
      decode: {
        properties: {
          content: {type: 'string'},
          format: {enum: ['json']}
        },
        required: ['content']
      },
      encode: {
        properties: {
          node: true,
          format: {enum: ['json']}
        },
        required: ['node']
      },
      compile: false,
      build: false,
      execute: false
    }
  }

  async decode (content: string, format: string = 'json'): Promise<Node> {
    if (format === 'json') return JSON.parse(content)
    return this.delegate(Method.decode, { content, format }, () => this.decode(content, 'json'))
  }

  async encode (node: Node, format: string = 'json'): Promise<string> {
    if (format === 'json') return JSON.stringify(node)
    return this.delegate(Method.encode, { node, format }, () => this.encode(node, 'json'))
  }

  async compile (node: Node): Promise<Node> {
    return this.delegate(Method.compile, { node }, async () => node)
  }

  async build (node: Node): Promise<Node> {
    return this.delegate(Method.build, { node }, async () => node)
  }

  async execute (node: Node): Promise<Node> {
    return this.delegate(Method.execute, { node }, async () => node)
  }

  private async delegate<Type> (method: Method, params: {[key: string]: any}, fallback: () => Promise<Type>): Promise<Type> {
    // TODO: match method / args to capabilities of peers
    return fallback()
  }
}
