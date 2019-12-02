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
 * Implements asynchronous, methods for `Executor` methods `call` and `notify`
 * which send JSON-RPC requests to a `Server` that is serving the remote `Executor`.
 */
export abstract class Client extends Executor {
  /**
   * A map of requests to which responses can be paired against
   */
  private requests: { [key: number]: (response: JsonRpcResponse) => void } = {}

  /**
   * @implements Implements {@link Executor.call} by sending a
   * a request to the remote `Executor` that this client is connected to.
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
    await this.send(request)
    return promise
  }

  /**
   * @implements Implements {@link Executor.notify} by sending a notification
   * to the remote `Executor` that this client is connected to.
   */
  public notify(level: string, message: string) {
    const notification = new JsonRpcRequest(level, { message }, false)
    this.send(notification)
  }

  /**
   * @implements Implements {@link Executor.notified} to receive a notification
   * from the remote executor that this client is connected to.
   *
   * @description Currently simply calls the appropriate method of
   * the `notifications` log instance. Override this to provide more fancy
   * notification to users.
   */
  public notified(level: string, message: string, node?: Node): void {
    switch (level) {
      case 'debug':
      case 'info':
      case 'warn':
      case 'error':
        notifications[level](message)
        break
      default:
        notifications.info(message)
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
   * Logs errors, rather than throwing exceptions, if the server sends a bad
   * response because this method is called asynchronously when a message
   * is received and to avoid crashing the process.
   *
   * @param message A JSON-RPC response (to a request) or a notification.
   */
  protected receive(message: string | JsonRpcResponse | JsonRpcRequest): void {
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message) as JsonRpcResponse | JsonRpcRequest
      } catch (error) {
        log.error(`Error parsing message as JSON: ${message}`)
        return
      }
    }
    const { id } = message

    if (id === undefined) {
      // A notification request
      const { method, params = [] } = message as JsonRpcRequest
      const args = Object.values(params)
      return this.notified(method, args[0], args[1])
    }

    // Must be a response....

    if (id < 0) {
      // A response with accidentally missing id
      log.error(`Response is missing id: ${JSON.stringify(message)}`)
      return
    }

    const resolve = this.requests[id]
    if (resolve === undefined) {
      log.error(`No request found for response with id: ${id}`)
      return
    }

    try {
      resolve(message as JsonRpcResponse)
    } catch (error) {
      const { message: errorMessage, stack } = error
      log.error({
        message: `Error thrown when handling message: ${errorMessage}\n${JSON.stringify(
          message
        )}`,
        stack
      })
    }

    delete this.requests[id]
  }

  /**
   * Start the client
   *
   * Derived classes may override this method.
   */
  public start(): Promise<void> {
    return Promise.resolve()
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
