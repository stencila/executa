import { JSONSchema7Definition } from 'json-schema'
import { Address } from './Transports'
import { Node, SoftwareSession } from '@stencila/schema'

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
export abstract class Executor {
  /**
   * Get the manifest of the executor
   *
   * @see Capabilities
   * @see Addresses
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
  abstract async encode(node: Node, format?: string): Promise<string>

  /**
   * Compile a `Node`.
   *
   * @param node The node to compile
   * @returns The compiled node
   */
  abstract async compile<NodeType extends Node>(
    node: NodeType
  ): Promise<NodeType>

  /**
   * Build a `Node`.
   *
   * @param node The node to build
   * @returns The build node
   */
  abstract async build<NodeType extends Node>(node: NodeType): Promise<NodeType>

  /**
   * Execute a `Node`.
   *
   * @param node The node to execute
   * @param session The session that the node will be executed in
   * @returns The node, with updated properties, after it has been executed
   */
  abstract async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession
  ): Promise<NodeType>

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
   * @param limits The limits on the `SoftwareSession` to be started, described as a `SoftwareSession`.
   * @returns The node, with updated properties, after it has begun running
   */
  abstract async begin<NodeType extends Node>(
    node: NodeType,
    limits?: SoftwareSession
  ): Promise<NodeType>

  /**
   * End running a `Node`.
   *
   * @param node The running node, usually but not necessarily, a `SoftwareSession`
   * @returns The node, with updated properties, after it has ended running
   */
  abstract async end<NodeType extends Node>(node: NodeType): Promise<NodeType>

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
