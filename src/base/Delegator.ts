import { getLogger } from '@stencila/logga'
import Ajv from 'ajv'
import { ClientType } from './Client'
import { Executor, Manifest, Method, Call } from './Executor'
import { InternalError } from './InternalError'
import { Transport } from './Transports'
import { CapabilityError } from './CapabilityError'

const ajv = new Ajv()

const log = getLogger('executa:delegator')

/**
 * An `Executor` class that delegates to peers.
 *
 * This executor class has no capabilities itself and
 * instead, delegates to other executors. If unable
 * to delegate to a peer, then calls a fallback function
 * which can be used to perform other handling.
 */
export class Delegator extends Executor {
  /**
   * Classes of `Client` that can be used
   * to connect to peer executors.
   */
  protected readonly clientTypes: ClientType[]

  /**
   * Peer executors that are delegated to depending
   * upon their capabilities and the request at hand.
   */
  protected readonly peers: { [key: string]: Peer } = {}

  public constructor(
    clientTypes: ClientType[] = [],
    manifests: { [key: string]: Manifest } = {}
  ) {
    super()
    this.clientTypes = clientTypes
    for (const [id, manifest] of Object.entries(manifests))
      this.add(id, manifest)
  }

  /**
   * @implements Implements {@link Executor.call} by delegating
   * all requests to peers.
   */
  public async call<Type>(
    method: Method,
    params: Call['params'] = {}
  ): Promise<Type> {
    for (const peer of Object.values(this.peers)) {
      if (peer.capable(method, params)) {
        if (peer.connect()) {
          return peer.call<Type>(method, params)
        }
      }
    }
    return Promise.reject(
      new CapabilityError(`Unable to delegate method "${method}"`)
    )
  }

  public add(id: string, manifest: Manifest): void {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const peer = new Peer(manifest, this.clientTypes)
    this.peers[id] = peer
  }

  public update(id: string, manifest: Manifest): void {
    const peer = this.peers[id]
    if (peer !== undefined) peer.manifest = manifest
    else this.add(id, manifest)
  }

  public remove(id: string): void {
    delete this.peers[id]
  }
}

/**
 * A instance of a `Executor` used as a peer
 * to delegate method calls to.
 */
export class Peer {
  /**
   * The manifest of the peer executor.
   */
  public manifest: Manifest

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
   * will depend upon the available transports in `manifest.addresses`.
   */
  private executor?: Executor

  /**
   * Ajv validation functions for each method.
   *
   * Validation functions are just-in-time compiled
   * in the `capable` method.
   */
  private validators: { [key: string]: Ajv.ValidateFunction[] } = {}

  public constructor(
    manifest: Manifest,
    clientTypes: ClientType[],
    executor?: Executor
  ) {
    this.manifest = manifest
    this.clientTypes = clientTypes
    this.executor = executor
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
    // Check if already connected
    if (this.executor !== undefined) return true

    // If the executor is in-process, just use it directly
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (this.manifest.id instanceof Executor) {
      this.executor = this.manifest.id
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
        WebSocketClient: Transport.ws
      }
      const transport = transportMap[ClientType.name]
      //  istanbul ignore next
      if (transport === undefined)
        throw new InternalError(
          `Wooah! A key is missing for "${ClientType.name}" in transportMap.`
        )

      // See if the peer has an address for the transport
      if (this.manifest.addresses === undefined) return false
      const address = this.manifest.addresses[transport]
      if (address !== undefined) {
        this.executor = new ClientType(address)
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
    //  istanbul ignore next
    if (this.executor === undefined)
      throw new InternalError(
        "WTF, no client! You shouldn't be calling this yet!"
      )
    return this.executor.call<Type>(method, params)
  }
}
