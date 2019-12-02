import { getLogger } from '@stencila/logga'
import { Node, SoftwareSession } from '@stencila/schema'
import { JSONSchema7Definition } from 'json-schema'
import {
  DirectAddress,
  HttpAddressInitializer,
  StdioAddressInitializer,
  TcpAddressInitializer,
  Transport,
  UdsAddress,
  VsockAddress,
  WebSocketAddressInitializer
} from './Transports'
import { InternalError } from './InternalError'

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
  execute = 'execute',
  begin = 'begin',
  end = 'end'
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

/**
 * The addresses of an `Executor`.
 */
export interface Addresses {
  direct?: DirectAddress
  stdio?: StdioAddressInitializer
  uds?: UdsAddress
  vsock?: VsockAddress
  tcp?: TcpAddressInitializer
  http?: HttpAddressInitializer
  ws?: WebSocketAddressInitializer
}

/**
 * The manifest for an `Executor` class
 * describing it's capabilities, how to spawn it
 * etc
 */
export interface Manifest {
  /**
   * The id of the `Executor`, or
   * the `Executor` instance itself if it
   * is in-process.
   */
  id?: string | Executor

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
   * Other properties that the `Executor`
   * implementations may wish to add
   * e.g. package name and version
   */
  [key: string]: any
}

/**
 * User information used in some methods for
 * authorization (e.g. limiting the number of
 * session that a user can have)
 */
export interface User {
  id?: string
  client?: {
    type: Transport
    id: string
  }
  session?: SoftwareSession
}

/**
 * Interface for `Executor` classes and their proxies.
 */
export abstract class Executor {
  /**
   * Get the manifest of the executor
   *
   * @see {@link Capabilities}
   * @see {@link Addresses}
   */
  public async manifest(): Promise<Manifest> {
    return this.call<Manifest>(Method.manifest)
  }

  /**
   * Decode content to a `Node`.
   *
   * @param content The content to decode
   * @param format The format of the content
   * @returns The decoded node
   */
  public async decode(content: string, format?: string): Promise<Node> {
    return this.call<Node>(Method.decode, { content, format })
  }

  /**
   * Encode a `Node` in a format.
   *
   * @param node The node to encode
   * @param format The format to encode
   * @returns The node encoded in the format
   */
  public async encode(node: Node, format?: string): Promise<string> {
    return this.call<string>(Method.encode, { node, format })
  }

  /**
   * Compile a `Node`.
   *
   * @param node The node to compile
   * @returns The compiled node
   */
  public async compile<NodeType extends Node>(
    node: NodeType
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.compile, { node })
  }

  /**
   * Build a `Node`.
   *
   * @param node The node to build
   * @returns The build node
   */
  public async build<NodeType extends Node>(node: NodeType): Promise<NodeType> {
    return this.call<NodeType>(Method.build, { node })
  }

  /**
   * Execute a `Node`.
   *
   * @param node The node to execute
   * @param session The session that the node will be executed in
   * @param user The `User` making the call
   * @returns The node, with updated properties, after it has been executed
   */
  public async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession,
    user?: User
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.execute, { node, session, user })
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
   * @param user The `User` making the call
   * @returns The node, with updated properties, after it has begun running
   */
  public async begin<NodeType extends Node>(
    node: NodeType,
    user?: User
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.begin, { node, user })
  }

  /**
   * End running a `Node`.
   *
   * @param node The running node, usually but not necessarily, a `SoftwareSession`
   * @param user The `User` making the request
   * @returns The node, with updated properties, after it has ended running
   */
  public async end<NodeType extends Node>(
    node: NodeType,
    user?: User
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.end, { node, user })
  }

  /**
   * Call one of the above methods.
   *
   * @param method The name of the method
   * @param params Values of parameters (i.e. arguments)
   */
  abstract async call<Type>(
    method: Method,
    params?: { [key: string]: any }
  ): Promise<Type>

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
  ): void {
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
}
