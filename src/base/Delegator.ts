import { getLogger } from '@stencila/logga'
import Ajv from 'ajv'
import { ClientType, clientTypeToTransport } from './Client'
import { Executor, Manifest, Method, Params } from './Executor'
import { InternalError } from './InternalError'
import { Transport } from './Transports'
import { CapabilityError } from './CapabilityError'
import { generate } from './uid'

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

  constructor(executors: Executor[] = [], clientTypes: ClientType[] = []) {
    super('de')
    this.clientTypes = clientTypes
    for (const executor of executors) this.add(executor)
  }

  /**
   * @override Override of {@link Executor.manifest} to
   * provide additional properties for inspection.
   */
  public async manifest(): Promise<Manifest> {
    const manifest = await super.manifest()
    const clientTypes = this.clientTypes.map(clientType => clientType.name)
    const peers = Object.entries(this.peers).reduce(
      (prev, [key, peer]) => ({
        ...prev,
        ...{ [key]: peer.manifest !== undefined ? peer.manifest : null }
      }),
      {}
    )
    return {
      ...manifest,
      clientTypes,
      peers
    }
  }

  /**
   * @implements Implements {@link Executor.call} by delegating
   * all requests to peers.
   */
  public async call(method: Method, params: Params = {}): Promise<any> {
    if (method === Method.manifest) return this.manifest()

    for (const peer of Object.values(this.peers)) {
      if (await peer.capable(method, params)) {
        if (await peer.connect()) {
          return peer.call(method, params)
        }
      }
    }
    return Promise.reject(
      new CapabilityError(
        `Unable to delegate method "${method}" with params "${JSON.stringify(
          params
        )}"`
      )
    )
  }

  /* eslint-disable @typescript-eslint/no-use-before-define */

  public add(executor: Executor, id?: string): string {
    id = id !== undefined ? id : generate('ex').toString()
    log.debug(`Adding peer ${id}`)
    const peer = new Peer(executor, this.clientTypes)
    this.peers[id] = peer
    return id
  }

  public update(id: string, manifest: Manifest): void {
    const peer = this.peers[id]
    if (peer !== undefined) {
      peer.update(manifest)
    } else {
      log.warn(`Peer with id not found, adding new peer: ${id}`)
      this.peers[id] = new Peer(undefined, this.clientTypes, manifest)
    }
  }

  /* eslint-enable @typescript-eslint/no-use-before-define */

  public remove(id: string): void {
    delete this.peers[id]
  }
}

/**
 * A instance of a `Executor` used as a peer
 * to delegate method calls to.
 */
export class Peer {
  executor?: Executor

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
   * The manifest of the peer executor.
   */
  public manifest?: Manifest

  /**
   * The interface to the peer executor.
   *
   * May be an in-process `Executor` or a `Client` to an out-of-process
   * `Executor`, in which case it's type e.g. `StdioClient` vs `WebSocketClient`
   * will depend upon the available transports in `manifest.addresses`.
   */
  private interface?: Executor

  /**
   * Ajv validation functions for each method.
   *
   * Validation functions are just-in-time compiled
   * in the `capable` method.
   */
  private validators: { [key: string]: Ajv.ValidateFunction[] } = {}

  public constructor(
    executor?: Executor,
    clientTypes: ClientType[] = [],
    manifest?: Manifest
  ) {
    this.executor = executor
    this.clientTypes = clientTypes
    this.manifest = manifest
  }

  /**
   * Initialize the peer manifest and
   * connection interface.
   */
  async initialize(): Promise<Manifest> {
    let { executor, manifest } = this

    if (executor !== undefined) {
      if (manifest === undefined)
        manifest = this.manifest = await executor.manifest()
      this.interface = executor
    } else {
      if (manifest === undefined) manifest = this.manifest = { version: 1 }
    }

    return manifest
  }

  /**
   * Update the peer with a new manifest.
   *
   * This method updates the manifest and resets the
   * capability validation functions.
   *
   * @param manifest The new manifest
   */
  update(manifest: Manifest) {
    this.manifest = manifest
    this.validators = {}
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
  public async capable(
    method: Method,
    params: { [key: string]: unknown }
  ): Promise<boolean> {
    let { manifest } = this
    if (manifest === undefined) manifest = await this.initialize()

    let validators = this.validators[method]
    if (validators === undefined) {
      // Peer does not have any capabilities defined
      if (manifest.capabilities === undefined) return false

      let capabilities = manifest.capabilities[method]
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
      const valid = validator(params) as boolean
      if (valid) return true
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
  public async connect(): Promise<boolean> {
    let { manifest } = this
    if (manifest === undefined) manifest = await this.initialize()

    // Check if already connected
    if (this.interface !== undefined) return true

    // Connect to remote executor in order of preference of
    // transports
    for (const ClientType of this.clientTypes) {
      const transport = clientTypeToTransport(ClientType)
      if (transport === undefined) {
        // Likely config error, logged in the above function
        continue
      }

      // See if the peer has an address for the transport
      if (manifest.addresses === undefined) return false
      const addresses = manifest.addresses[transport]
      if (addresses !== undefined) {
        let address
        if (Array.isArray(addresses)) {
          // TODO: choose the best address for this client
          // e.g. based on network localhost, local, global
          address = addresses[0]
        } else {
          address = addresses
        }
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
    //  istanbul ignore next
    if (this.interface === undefined)
      throw new InternalError(
        "WTF, no client! You shouldn't be calling this yet!"
      )
    return this.interface.call<Type>(method, params)
  }
}
