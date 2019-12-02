import { getLogger } from '@stencila/logga'
import { Node } from '@stencila/schema'
import { Manager } from './Manager'
import { Executor, User } from './Executor'
import { InternalError } from './InternalError'
import { JsonRpcError, JsonRpcErrorCode } from './JsonRpcError'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { Address } from './Transports'

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

  /**
   * Get the address of the server
   */
  public abstract get address(): Address

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
    node?: Node,
    clients?: string[]
  ): void {
    // Only servers that have persistent connections can implement this
  }

  /**
   * Receive a request or notification
   *
   * @param request A JSON-RPC request from a client
   * @param user An object representing the user and their rights,
   *             usually a JWT payload
   * @param stringify Should the response be stringified?
   * @returns If receiving a request then a JSON-RPC response as an
   *          object or string (default).
   *          If receiving a notification then nothing is returned.
   */
  protected async receive(
    request: string | JsonRpcRequest,
    user: User = {},
    stringify = true
  ): Promise<string | JsonRpcResponse | void> {
    if (this.executor === undefined)
      throw new InternalError('Executor has not been initialized')

    let id: number | undefined
    let result
    let error: JsonRpcError | undefined

    try {
      request = JsonRpcRequest.create(request)
      id = request.id
      const { method } = request

      // Notification: pass on to executor and do not return anything
      if (id === undefined) {
        this.executor.notified(
          method,
          request.param(0, 'message'),
          request.param(1, 'node', false)
        )
        return
      }

      // Method call request: return result or any error
      switch (method) {
        case 'manifest':
          result = await this.executor.manifest()
          break
        case 'decode':
          result = await this.executor.decode(
            request.param(0, 'content'),
            request.param(1, 'format', false)
          )
          break
        case 'encode':
          result = await this.executor.encode(
            request.param(0, 'node'),
            request.param(1, 'format', false)
          )
          break
        case 'execute':
          result = await this.executor.execute(
            request.param(0, 'node'),
            request.param(1, 'session', false),
            // Any `user` parameter requested is ignored and instead
            // the user from the server (e.g. based on a JWT) is applied
            user
          )
          break
        case 'begin':
        case 'end':
          result = await this.executor[method](
            request.param(0, 'node'),
            // Any `user` parameter requested is ignored and instead
            // the user from the server (e.g. based on a JWT) is applied
            user
          )
          break
        case 'compile':
        case 'build':
          result = await this.executor[method](request.param(0, 'node'))
          break
        default:
          throw new JsonRpcError(
            JsonRpcErrorCode.MethodNotFound,
            `Method not found: "${request.method}"`
          )
      }
    } catch (exc) {
      if (exc instanceof JsonRpcError) {
        // A JSON-RPC client error (e.g. missing parameters), do
        // not log it (to avoid noisy logs), just send to the client.
        error = exc
      } else {
        // Some sort of internal error, so log it and wrap
        // it into a JSON RPC error to send to the client.
        log.error(exc)
        error = new JsonRpcError(
          JsonRpcErrorCode.ServerError,
          `Internal error: ${exc.message}`,
          {
            trace: exc.stack
          }
        )
      }
    }

    const response = new JsonRpcResponse(id, result, error)
    return stringify ? JSON.stringify(response) : response
  }

  /**
   * Start the server
   *
   * When overriding this method, derived classes should
   * call this method, or ensure that `executor` is set themselves.
   */
  public start(executor?: Executor): Promise<void> {
    if (executor === undefined) executor = new Manager()
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

  /**
   * Run the server with graceful shutdown on `SIGINT` or `SIGTERM`
   */
  public run(): Promise<void> {
    const stop = (): void => {
      this.stop()
        .then(() => process.exit())
        .catch(error =>
          log.error(`Error when stopping server: ${error.message}`)
        )
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    return this.start()
  }
}
