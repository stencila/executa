import { Node, SoftwareSession } from '@stencila/schema'
import { Executor, Manifest, Method, User } from './Executor'
import { JsonRpcError, JsonRpcErrorCode } from './JsonRpcError'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { InternalError } from './InternalError'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:client')

const notifications = getLogger('executa:client:notifs')

/**
 * A client to a remote, out of process, `Executor`.
 *
 * Implements asynchronous, methods for `Executor` methods `compile`, `build`, `execute`, etc.
 * which send JSON-RPC requests to a `Server` that is serving the remote `Executor`.
 */
export abstract class Client implements Executor {
  /**
   * A map of requests to which responses can be paired against
   */
  private requests: { [key: number]: (response: JsonRpcResponse) => void } = {}

  /**
   * Call the remote `Executor`'s `manifest` method
   */
  public async manifest(): Promise<Manifest> {
    return this.call<Manifest>(Method.manifest)
  }

  /**
   * Call the remote `Executor`'s `decode` method
   */
  public async decode(content: string, format = 'json'): Promise<Node> {
    return this.call<string>(Method.decode, { content, format })
  }

  /**
   * Call the remote `Executor`'s `encode` method
   */
  public async encode(node: Node, format = 'json'): Promise<string> {
    return this.call<string>(Method.encode, { node, format })
  }

  /**
   * Call the remote `Executor`'s `compile` method
   */
  public async compile<NodeType extends Node>(
    node: NodeType
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.compile, { node })
  }

  /**
   * Call the remote `Executor`'s `build` method
   */
  public async build<NodeType extends Node>(node: NodeType): Promise<NodeType> {
    return this.call<NodeType>(Method.build, { node })
  }

  /**
   * Call the remote `Executor`'s `execute` method
   */
  public async execute<NodeType extends Node>(
    node: NodeType,
    session?: SoftwareSession
  ): Promise<NodeType> {
    return this.call<NodeType>(Method.execute, { node, session })
  }

  /**
   * Call the remote `Executor`'s `begin` method
   */
  public async begin<NodeType extends Node>(node: NodeType): Promise<NodeType> {
    return this.call<NodeType>(Method.begin, { node })
  }

  /**
   * Call the remote `Executor`'s `end` method
   */
  public async end<NodeType extends Node>(node: NodeType): Promise<NodeType> {
    return this.call<NodeType>(Method.end, { node })
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
    const request = new JsonRpcRequest(method, params)
    const id = request.id
    if (id === undefined)
      throw new InternalError('Request should have id defined')

    const promise = new Promise<Type>((resolve, reject) => {
      this.requests[id] = (response: JsonRpcResponse) => {
        const { result, error } = response
        if (error !== undefined) reject(error)
        else resolve(result)
      }
    })
    this.send(request)
    return promise
  }

  /**
   * @implements {Executor.notify}
   *
   * Send a notification to the remote executor.
   */
  public notify(level: string, message: string) {
    const notification = new JsonRpcRequest(level, { message }, false)
    this.send(notification)
  }

  /**
   * @implements {Executor.notified}
   *
   * Receive a notification from the remote executor.
   * Just calls the appropriate method of `log`. Override this to
   * provide more fancy notification to users.
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
   * Send a request to the server.
   *
   * This method must be overriden by derived client classes to
   * send the request over the transport used by that class.
   *
   * @param request The JSON-RPC request
   */
  protected abstract send(request: JsonRpcRequest): void

  /**
   * Receive a response from the server.
   *
   * Usually called asynchronously via the `send` method of a derived class
   * when a response is returned. Uses the `id` of the response to match it to the corresponding
   * request and resolve it's promise.
   *
   * @param message A JSON-RPC response (to a request) or a notification.
   */
  protected receive(message: string | JsonRpcResponse | JsonRpcRequest): void {
    if (typeof message === 'string')
      message = JSON.parse(message) as JsonRpcResponse | JsonRpcRequest
    const { id } = message

    if (id === undefined) {
      // A notification request
      const { method, params = [] } = message as JsonRpcRequest
      const args = Object.values(params)
      return this.notified(method, args[0], args[1])
    }

    // Must be a response....
    message = message as JsonRpcResponse
    if (id < 0)
      // A response with accidentally missing id
      throw new JsonRpcError(
        JsonRpcErrorCode.InternalError,
        `Response is missing id: ${message}`
      )
    const resolve = this.requests[id]
    if (resolve === undefined)
      throw new JsonRpcError(
        JsonRpcErrorCode.InternalError,
        `No request found for response with id: ${id}`
      )
    resolve(message)
    delete this.requests[id]
  }

  /**
   * Stop the client
   *
   * Derived classes may override this method.
   */
  public stop(): Promise<void> {
    return Promise.resolve()
  }
}

export interface ClientType {
  new (address: any): Client
}
