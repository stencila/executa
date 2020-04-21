import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import { Executor, Claims, Method } from './Executor'
import {
  InternalError,
  MethodUnknownError,
  ParamRequiredError,
  CapabilityError,
} from './errors'
import { JsonRpcError, JsonRpcErrorCode } from './JsonRpcError'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { Addresses } from './Transports'

const log = getLogger('executa:server')

/**
 * A base server class that passes JSON-RPC requests
 * from `Client`s to a `Executor`.
 */
export abstract class Server {
  /**
   * The executor that this server dispatches to.
   */
  protected executor?: Executor

  public constructor(executor?: Executor) {
    this.executor = executor
  }

  /**
   * Get the addresses of this server.
   *
   * A server will usually on have one address type (e.g. `http`, `ws`)
   * but may have more than one address for each type.
   */
  public abstract addresses(): Promise<Addresses>

  /**
   * Send a notification to one or more clients.
   *
   * @param level The notification level e.g. `info`, `error`
   * @param message The notification message
   * @param node The node to which this notification relates e.g. a `SoftwareSession`
   * @param clients The ids of the clients to send the notification to. If missing send to all clients.
   *
   * @see {@link Executor.notify}
   * @see {@link Client.notify}
   */
  public notify(
    level: string,
    message: string,
    node?: schema.Node,
    clients?: string[]
  ): void {
    // Only servers that have persistent connections can implement this
  }

  /**
   * Receive a request or notification
   *
   * @param request A JSON-RPC request from a client
   * @param claims An object representing the claims for the request,
   *             usually a from a JWT payload
   * @param stringify Should the response be stringified?
   * @returns If receiving a request then a JSON-RPC response as an
   *          object or string (default).
   *          If receiving a notification then nothing is returned.
   */
  protected async receive(
    request: string | JsonRpcRequest,
    claims: Claims = {},
    stringify = true
  ): Promise<string | JsonRpcResponse | void> {
    if (this.executor === undefined)
      throw new InternalError('Executor has not been initialized')

    let id: string | undefined
    let result
    let error: JsonRpcError | undefined

    try {
      // Create a JSON-RPC request
      request = JsonRpcRequest.create(request)
      id = request.id
      let { method, params } = request

      // Any `claims` parameter is ignored and instead
      // the claims from the server (e.g. based on a JWT) is applied
      params = { ...params, claims }

      // This is a notification: pass on to executor and do not return anything
      if (id === undefined) {
        this.executor.notified(method, params.message, params.node)
        return
      }

      // This is a method call: return result or any error
      result = await this.executor.dispatch(method as Method, params)
    } catch (exc) {
      if (
        !(
          exc instanceof JsonRpcError ||
          exc instanceof MethodUnknownError ||
          exc instanceof ParamRequiredError ||
          exc instanceof CapabilityError
        )
      ) {
        // Some sort of internal error, so log it.
        log.error(exc)
      }
      error = JsonRpcError.fromError(exc)
    }

    const response = new JsonRpcResponse(
      id !== undefined ? id : '',
      result,
      error
    )
    return stringify ? JSON.stringify(response) : response
  }

  /**
   * Start the server
   *
   * When overriding this method, derived classes should
   * call this method, or ensure that `this.executor` is set themselves.
   */
  public start(executor: Executor): Promise<void> {
    this.executor = executor
    return Promise.resolve()
  }

  /**
   * Stop the server
   *
   * Derived classes may override this method.
   */
  public stop(): Promise<void> {
    return Promise.resolve()
  }
}
