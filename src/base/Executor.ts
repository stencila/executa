import { Node } from '@stencila/schema'
import { JSONSchema7Definition } from 'json-schema'
import Ajv from 'ajv'
import Client from './Client'
import Server from './Server'
import { Address, Transport } from './Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:executor')

/**
 * The methods of an `Executor` class.
 */
export enum Method {
  manifest = 'manifest',
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
 *
 * An executor does not need to defined a capability
 * for all methods. A missing capability implies no
 * capability for that method.
 */
export interface Capabilities {
  [key: string]: JSONSchema7Definition
}

export interface Addresses {
  [key: string]: Address
}

/**
 * The manifest for an `Executor` class
 * describing it's capabilities, how to spawn it
 * etc
 */
export interface Manifest {
  /**
   * The capabilities of the executor
   */
  capabilities: Capabilities

  /**
   * The addresses of servers that can be used
   * to communicate with the executor
   */
  addresses: Addresses
}

/**
 * Interface for `Executor` classes and their proxies.
 */
export abstract class Interface {
  /**
   * Get the manifest of the executor
   *
   * @see Capabilities
   */
  abstract async manifest(): Promise<Manifest>

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

  /**
   * Call one of the above methods.
   *
   * @param method The name of the method
   * @param params Values of parameters (i.e. arguments)
   */
  abstract async call<Type>(
    method: Method,
    params: { [key: string]: any }
  ): Promise<Type>
}

const ajv = new Ajv()

/**
 * A instance of a `Executor` used as a peer
 * to delegate method calls to.
 *
 * A peer can be created from:
 *
 * - a `Client` to an existing executor e.g.
 *   a `WebSocketClient` to an executor running on
 *   a remote machine.
 */
class Peer {
  /**
   * The manifest of the peer executor.
   */
  private manifest: Manifest

  // private Clients: new ()

  /**
   * The client for the peer executor.
   *
   * The type of client e.g. `StdioClient` vs `WebSocketClient`
   * will depend upon the available transports in `manifest.transports`.
   */
  private client?: Client

  /**
   * Ajv validation functions for each method.
   *
   * Validation functions are just-in-time compiled
   * in the `capable` method.
   */
  private validators: { [key: string]: Ajv.ValidateFunction } = {}

  public constructor(manifest: Manifest) {
    this.manifest = manifest
  }

  /**
   * Test whether the peer is capable of executing the
   * method with the supplied parameters.
   *
   * Just-in-time compiles the JSON Schema for each capability
   * into a validator function that is used to "validate"
   * the parameters.
   *
   * @param method The method to be called
   * @param params The parameter values of the call
   */
  public capable(method: Method, params: { [key: string]: unknown }): boolean {
    let validator = this.validators[method]
    if (validator === undefined) {
      const capability = this.manifest.capabilities[method]
      // Peer does not have capability defined
      if (capability === undefined) return false
      // Peer defines capability as boolean (which is a valid JSON Schema)
      if (typeof capability === 'boolean') return capability
      // Peer defines capability as a JSON Schema object which requires compiling
      // to a validator function, that is cached
      validator = this.validators[method] = ajv.compile(capability)
    }
    return validator(params) as boolean
  }

  public connect(): Client {
    let client: Client
    // @ts-ignore
    return client
  }

  /**
   * Call a method of a remote `Executor`.
   *
   * @param method The name of the method
   * @param params Values of parameters (i.e. arguments)
   */
  public async call<Type>(
    method: Method,
    params: { [key: string]: any } = {}
  ): Promise<Type> {
    if (this.client === undefined) {
      this.client = this.connect()
    }
    return this.client.call<Type>(method, params)
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

  /**
   * Servers that will pass on requests to this executor.
   */
  private servers: Server[] = []

  public constructor(peers: Manifest[] = []) {
    // Create peers using the manifests provided
    this.peers = peers.map(peer => new Peer(peer))
  }

  /**
   * Start servers for the executor.
   *
   * @param servers An array of `Server` instances that pass
   *                requests on to this executor
   */
  public start(servers: Server[] = []): void {
    this.servers = servers
    log.info('Starting servers')
    this.servers.forEach(server => server.start())
  }

  /**
   * Stop servers for the executor.
   */
  public stop(): void {
    log.info('Stopping servers')
    this.servers.forEach(server => server.stop())
  }

  /**
   * Get the manifest of the executor
   *
   * Derived classes may override this method,
   * but will normally just override `capabilities()`.
   */
  public async manifest(): Promise<Manifest> {
    return {
      capabilities: await this.capabilities(),
      addresses: await this.addresses()
    }
  }

  /**
   * Get the capabilities of the executor
   *
   * Derived classes will usually override this method
   * to declare additional node types that methods such
   * as `compile` and `execute` can handle.
   */
  protected async capabilities(): Promise<Capabilities> {
    return {
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
      }
    }
  }

  /**
   * Get a map of server addresses for this executor.
   */
  protected async addresses(): Promise<Addresses> {
    return this.servers
      .map(server => server.address())
      .reduce((prev, curr) => ({ ...prev, ...{ [curr.type]: curr } }), {})
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

  public async call(
    method: Method,
    params: { [key: string]: any }
  ): Promise<any> {
    switch (method) {
      case Method.decode:
        return this.decode(params['content'], params['format'])
      case Method.encode:
        return this.encode(params['node'], params['format'])
      case Method.compile:
        return this.compile(params['node'])
      case Method.build:
        return this.build(params['node'])
      case Method.execute:
        return this.execute(params['node'])
    }
  }

  private async delegate<Type>(
    method: Method,
    params: { [key: string]: any },
    fallback: () => Promise<Type>
  ): Promise<Type> {
    // Attempt to delegate to a peer
    for (const peer of this.peers) {
      if (peer.capable(method, params)) {
        return peer.call<Type>(method, params)
      }
    }
    // No peer has necessary capability so resort to fallback
    return fallback()
  }
}
