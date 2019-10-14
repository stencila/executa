import { Node, isPrimitive, nodeType } from '@stencila/schema'
import { JSONSchema7Definition } from 'json-schema'
import Ajv from 'ajv'
import { ClientType } from './Client'
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
  [key: string]: JSONSchema7Definition | JSONSchema7Definition[]
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
   * The actual in-process `Executor`, or
   * it's id i it is ou-of-process
   */
  executor?: Executor | string

  /**
   * The capabilities of the executor
   */
  capabilities?: Capabilities

  /**
   * The addresses of servers that can be used
   * to communicate with the executor
   */
  addresses?: Addresses
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
export class Peer {
  /**
   * The manifest of the peer executor.
   */
  public readonly manifest: Manifest

  /**
   * A list of classes, that extend `Client`, and are available
   * to connect to peer executors.
   *
   * This property is used for dependency injection, rather than importing
   * clients for all transports into this module when they may
   * not be used (e.g. `StdioClient` in a browser hosted `Executor`).
   * The order of this list, defines the preference for the transport.
   */
  public readonly clientTypes: ClientType[]

  /**
   * The interface to the peer executor.
   *
   * May be an in-process `Executor` or a `Client` to an out-of-process
   * `Executor`, in which case it's type e.g. `StdioClient` vs `WebSocketClient`
   * will depend upon the available transports in `manifest.transports`.
   */
  private interface?: Interface

  /**
   * Ajv validation functions for each method.
   *
   * Validation functions are just-in-time compiled
   * in the `capable` method.
   */
  private validators: { [key: string]: Ajv.ValidateFunction[] } = {}

  public constructor(manifest: Manifest, clientTypes: ClientType[]) {
    this.manifest = manifest
    this.clientTypes = clientTypes
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
    let validators = this.validators[method]
    if (validators === undefined) {
      // Peer does not have any capabilities defined
      if (this.manifest.capabilities === undefined) return false

      let capabilities = this.manifest.capabilities[method]
      // Peer does not have any capabilities for this method defined
      if (capabilities === undefined) return false

      // Peer defines capability as a single JSON Schema definition
      if (!Array.isArray(capabilities)) capabilities = [capabilities]

      // Compile JSON Schema definitions to validation functions
      validators = this.validators[method] = capabilities.map(schema =>
        ajv.compile(schema)
      )
    }
    for (const validator of validators) {
      if (validator(params) === true) return true
    }
    return false
  }

  /**
   * Connect to the `Executor`.
   *
   * Finds the first client type that the peer
   * executor supports.
   *
   * @returns A client instance or `undefined` if not able to connect
   */
  public connect(): boolean {
    // If the executor is in-process, just use it directly
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (this.manifest.executor instanceof Executor) {
      this.interface = this.manifest.executor
      return true
    }
    // Connect to remote executor in order of preference of
    // transports
    for (const ClientType of this.clientTypes) {
      // Get the transport for the client type
      // There should be a better way to do this
      const transportMap: { [key: string]: Transport } = {
        DirectClient: Transport.direct,
        StdioClient: Transport.stdio,
        VsockClient: Transport.vsock,
        TcpClient: Transport.tcp,
        HttpClient: Transport.http,
        WebsocketClient: Transport.ws
      }
      const transport = transportMap[ClientType.name]
      if (transport === undefined)
        throw new Error('Wooah! This should not happen!')

      // See if the peer has an address for the transport
      if (this.manifest.addresses === undefined) return false
      const address = this.manifest.addresses[transport]
      if (address !== undefined) {
        this.interface = new ClientType(address)
        return true
      }
    }
    // Unable to connect to the peer
    return false
  }

  /**
   * Call a method of a remote `Executor`.
   *
   * Ensures that there is a connection to the
   * executor and then passes the request to it.
   *
   * @param method The name of the method
   * @param params Values of parameters (i.e. arguments)
   */
  public async call<Type>(
    method: Method,
    params: { [key: string]: any } = {}
  ): Promise<Type> {
    if (this.interface === undefined)
      throw new Error("WTF, no client! You shouldn't be calling this!")
    return this.interface.call<Type>(method, params)
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

  public constructor(
    manifests: Manifest[] = [],
    clientTypes: ClientType[] = []
  ) {
    this.peers = manifests.map(manifest => new Peer(manifest, clientTypes))
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
    const capabilities: Capabilities = {
      decode: [
        {
          properties: {
            content: { type: 'string' },
            format: { enum: ['json'] }
          },
          required: ['content']
        }
      ],
      encode: [
        {
          properties: {
            node: true,
            format: { enum: ['json'] }
          },
          required: ['node']
        }
      ],
      compile: [],
      build: [],
      execute: []
    }
    for (const peer of this.peers) {
      const manifest = peer.manifest
      if (manifest.capabilities === undefined) continue
      for (const [method, additional] of Object.entries(
        manifest.capabilities
      )) {
        const current = capabilities[method]
        capabilities[method] = [
          ...(Array.isArray(current) ? current : [current]),
          ...(Array.isArray(additional) ? additional : [additional])
        ]
      }
    }
    return capabilities
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

  /**
   * Execute a `Node`.
   *
   * Walks the node tree and attempts to delegate
   * execution of certain types of nodes (currently `CodeChunk` and `CodeExpression`).
   *
   * @param node The node to execute
   */
  public async execute(node: Node): Promise<Node> {
    return this.walk(node, async node => {
      switch (nodeType(node)) {
        case 'CodeChunk':
        case 'CodeExpression':
          return this.delegate(Method.execute, { node }, async () => node)
      }
      return node
    })
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

  private async walk(
    node: Node,
    transformer: (node: Node) => Promise<Node>
  ): Promise<Node> {
    return walk(node)
    async function walk(node: Node): Promise<Node> {
      const transformed = await transformer(node)
      if (transformed === undefined || isPrimitive(transformed))
        return transformed
      if (Array.isArray(transformed)) return Promise.all(transformed.map(walk))
      return Object.entries(transformed).reduce(
        async (prev, [key, child]) => ({
          ...(await prev),
          ...{ [key]: await walk(child) }
        }),
        Promise.resolve({})
      )
    }
  }

  private async delegate<Type>(
    method: Method,
    params: { [key: string]: any },
    fallback: () => Promise<Type>
  ): Promise<Type> {
    log.debug(`Delegating: ${method}(${Object.keys(params).join(', ')})`)

    // Attempt to delegate to a peer
    for (const peer of this.peers) {
      if (peer.capable(method, params)) {
        if (peer.connect()) {
          return peer.call<Type>(method, params)
        }
      }
    }

    // No peer has necessary capability so resort to fallback
    log.debug(`Unable to delegate node: ${JSON.stringify(params)} `)
    return fallback()
  }
}
