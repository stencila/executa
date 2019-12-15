import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import { JSONSchema7Definition } from 'json-schema'
import {
  InternalError,
  MethodUnknownError,
  ParamRequiredError,
  CapabilityError
} from './errors'
import { Addresses, Transport } from './Transports'
import { generate } from './uid'

const log = getLogger('executa:executor')

/**
 * The methods of an `Executor` class.
 */
export enum Method {
  manifest = 'manifest',
  decode = 'decode',
  encode = 'encode',
  query = 'query',
  compile = 'compile',
  build = 'build',
  execute = 'execute',
  begin = 'begin',
  end = 'end',
  pipe = 'pipe'
}

/**
 * The parameters of a call to a method
 */
export type Params = { [key: string]: any }

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

/**
 * The manifest for an `Executor` class
 * describing it's capabilities, addresses that
 * can be used to connect to it etc.
 *
 * All properties are optional to reduce the
 * number of assumptions that need to be made
 * in handling manifests read from file, or received
 * over the network.
 *
 * Executor implementations may add other properties
 * to the manifest for inspection purposes
 * (e.g. debugging, monitoring).
 */
export interface Manifest {
  /**
   * The version of the manifest schema
   */
  version: number

  /**
   * The id of the `Executor`
   */
  id?: string

  /**
   * The capabilities of the executor
   */
  capabilities?: Capabilities

  /**
   * The addresses of servers that can be used
   * to communicate with the executor
   */
  addresses?: Addresses

  /**
   * Other properties that `Executor`
   * implementations may wish to add
   * e.g. package name and version
   */
  [key: string]: any
}

/**
 * Information used in some methods for
 * authorization (e.g. limiting the number
 * of users accessing a session, limiting
 * the resources used by a session)
 */
export interface Claims {
  user?: {
    id: string
  }
  client?: {
    type: Transport
    id: string
  }
  session?: schema.SoftwareSession

  // Allow for other arbitrary properties
  [key: string]: any
}

/**
 * Interface for `Executor` classes and their proxies.
 */
export abstract class Executor {
  /**
   * The unique id of this executor.
   *
   * Used for better tracing and to avoid duplicate
   * entries for an executor (e.g. due to having multiple servers
   * and therefore multiple addresses)
   */
  public readonly id: string

  /**
   * Construct an executor.
   *
   * @param family A two letter code used to help
   * identify the type of executor
   */
  public constructor(family = 'ex') {
    this.id = generate(family).toString()
  }

  /**
   * Get the addresses of this executor.
   *
   * Derived classes can override this method
   * to provide addresses in their manifest.
   */
  public addresses(): Promise<Addresses | undefined> {
    return Promise.resolve(undefined)
  }

  /**
   * Get the capabilities of this executor.
   *
   * Derived classes can override this method
   * to provide capabilities in their manifest.
   */
  public capabilities(): Promise<Capabilities | undefined> {
    return Promise.resolve(undefined)
  }

  /**
   * Get the manifest of the executor.
   *
   * @see {@link Capabilities}
   * @see {@link Addresses}
   */
  public async manifest(): Promise<Manifest> {
    return {
      version: 1,
      id: this.id.toString(),
      addresses: await this.addresses(),
      capabilities: await this.capabilities()
    }
  }

  /**
   * Decode content to a `Node`.
   *
   * @param content The content to decode
   * @param format The format of the content
   * @returns The decoded node
   */
  public async decode(content: string, format: string): Promise<schema.Node> {
    return this.call<schema.Node>(Method.decode, { content, format })
  }

  /**
   * Encode a `Node` in a format.
   *
   * @param node The node to encode
   * @param format The format to encode
   * @returns The node encoded in the format
   */
  public async encode(node: schema.Node, format: string): Promise<string> {
    return this.call<string>(Method.encode, { node, format })
  }

  /**
   * Query a `Node`.
   *
   * Currently allows for two query languages:
   *
   * - [JMESPath](http://jmespath.org/) (default)
   * - [JSONPointer](https://tools.ietf.org/html/rfc6901)
   */
  public query(
    node: schema.Node,
    query: string,
    lang: 'jmes-path' | 'json-pointer' = 'jmes-path'
  ): Promise<schema.Node> {
    return this.call<schema.Node>(Method.query, { node, query, lang })
  }

  /**
   * Compile a `Node`.
   *
   * @param node The node to compile
   * @returns The compiled node
   */
  public async compile<Type extends schema.Node>(node: Type): Promise<Type> {
    return this.call<Type>(Method.compile, { node })
  }

  /**
   * Build a `Node`.
   *
   * @param node The node to build
   * @returns The build node
   */
  public async build<Type extends schema.Node>(node: Type): Promise<Type> {
    return this.call<Type>(Method.build, { node })
  }

  /**
   * Execute a `Node`.
   *
   * @param node The node to execute
   * @param session The session that the node will be executed in
   * @param claims The `Claims` made for the call
   * @returns The node, with updated properties, after it has been executed
   */
  public async execute<Type extends schema.Node>(
    node: Type,
    session?: schema.SoftwareSession,
    claims?: Claims
  ): Promise<Type> {
    return this.call<Type>(Method.execute, { node, session, claims })
  }

  /**
   * Begin running a `Node`.
   *
   * This method keeps a document "running", usually to allow it to react
   * to changes within it. Compare this to `execute()` which will not wait
   * and will simply execute all nodes in the document.
   * The document will keep running until the `end()` method is called on it.
   *
   * Usually this method is called with a `SoftwareSession` as the
   * `node` argument. However, it could also be called with another `Node`
   * type, e.g. an `Article`, in which case the executor may begin it's
   * `session` property, or default session if that property is missing.
   *
   * @param node The node to run, usually but not necessarily, a `SoftwareSession`
   * @param claims The `Claims` made for the call
   * @returns The node, with updated properties, after it has begun running
   */
  public async begin<Type extends schema.Node>(
    node: Type,
    claims?: Claims
  ): Promise<Type> {
    return this.call<Type>(Method.begin, { node, claims })
  }

  /**
   * End running a `Node`.
   *
   * @param node The running node, usually but not necessarily, a `SoftwareSession`
   * @param claims The `Claims` made for the call
   * @returns The node, with updated properties, after it has ended running
   */
  public async end<Type extends schema.Node>(
    node: Type,
    claims?: Claims
  ): Promise<Type> {
    return this.call<Type>(Method.end, { node, claims })
  }

  /**
   * Call a pipeline of methods passing the result of each call as the
   * first argument of the next call.
   *
   * This method is a "meta" method that is used to chain together calls to other methods.
   * When using a remote executor, it is more efficient than chaining those calls together
   * "by hand" because it only involves one round trip request to the executor.
   *
   * @param node The node to pipe through methods
   * @param calls A list of method, parameters tuples to pipe the node through
   * @returns The node after it has been piped through the methods
   */
  public async pipe(
    node: schema.Node,
    calls: (Method | [Method, Params])[]
  ): Promise<schema.Node> {
    return this.call<schema.Node>(Method.pipe, { node, calls })
  }

  /**
   * Dispatch a call to one of the above methods.
   *
   * This method does run time dispatching. It is used
   * by classes such as `Server` (to fulfil and JSON-RPC request),
   * `Queuer` (to remove calls from a queue) and elsewhere for
   * running the `pipe` method.
   *
   * It does runtime checking for the method name and
   * required parameters.
   */
  public dispatch(method: Method, params: Params = {}): Promise<any> {
    switch (method) {
      case Method.manifest:
        return this.manifest()
      case Method.decode:
        return this.decode(param(0, 'content'), param(1, 'format'))
      case Method.encode:
        return this.encode(param(0, 'node'), param(1, 'format'))
      case Method.query:
        return this.query(param(0, 'node'), param(1, 'query'), param(1, 'lang', false))
      case Method.compile:
        return this.compile(param(0, 'node'))
      case Method.build:
        return this.build(param(0, 'node'))
      case Method.execute:
        return this.execute(
          param(0, 'node'),
          param(1, 'session', false),
          param(2, 'claims', false)
        )
      case Method.begin:
        return this.begin(param(0, 'node'), param(1, 'claims', false))
      case Method.end:
        return this.end(param(0, 'node'), param(1, 'claims', false))
      case Method.pipe:
        return this.pipe(param(0, 'node'), param(1, 'calls'))
    }
    throw new MethodUnknownError(method)

    /**
     * Get a parameter value.
     *
     * The number `index` is necessary to to be able to extract
     * the first, forward piped, argument created when
     * piping (e.g `{ 0: node, format: 'json'}` instead of
     * `{ node: node, format: 'json'}`).
     *
     * @param index The index of the parameter
     * @param name The name of the parameter
     * @param required Is the parameter required?
     */
    function param(index: number, name: string, required = true): any {
      let value = params[name]
      if (value === undefined) value = params[index]
      if (required && value === undefined) throw new ParamRequiredError(name)
      return value
    }
  }

  /**
   * A fallback implementation of one of the above methods.
   *
   * Since this base executor has no capabilities, this method
   * simply throws a `CapabilityError`. Derived classes, may
   * override this method, and /or one of the methods above.
   *
   * Provided so that derived classes such as `Client`, `Delegator`
   * and `Queuer` can override a single method to provide their
   * functionality instead of having to implement each of the above methods.
   *
   * @param method The name of the method
   * @param params Values of parameters (i.e. arguments)
   */
  public call<Type>(method: Method, params: Params): Promise<Type> {
    throw new CapabilityError(method, params)
  }

  /**
   * Send a notification
   *
   * @param level The notification level e.g. `info`, `error`
   * @param message The notification message
   * @param node The node to which this notification relates e.g. a `SoftwareSession`
   * @param clients The ids of the clients to send the notification to. If missing send to all clients.
   */
  public notify(
    level: string,
    message: string,
    node?: Node,
    clients?: string[]
  ): Promise<void> {
    throw new InternalError(
      'Method notify should be implemented in derived classes'
    )
  }

  /**
   * Receive a notification
   *
   * @param level The notification level e.g. `info`, `error`
   * @param message The notification message
   * @param node The node to which this notification relates e.g. a `SoftwareSession`
   */
  public notified(level: string, message: string, node?: Node): void {
    switch (level) {
      case 'debug':
      case 'info':
      case 'warn':
      case 'error':
        log[level](message)
        break
      default:
        log.info(message)
    }
  }

  /**
   * Start the executor
   *
   * Derived classes may override this method.
   */
  public start(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * Stop the executor
   *
   * Derived classes may override this method.
   */
  public stop(): Promise<void> {
    return Promise.resolve()
  }
}
