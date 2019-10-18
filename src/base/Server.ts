import { Executor } from './Executor'
import Error from './JsonRpcError'
import JsonRpcRequest from './JsonRpcRequest'
import JsonRpcResponse from './JsonRpcResponse'
import { Address } from './Transports'

/**
 * A base server class that passes JSON-RPC requests
 * from `Client`s to a `Executor`.
 */
export default abstract class Server {
  /**
   * The executor that this server dispatches to.
   */
  private executor: Executor

  public constructor(executor?: Executor) {
    if (executor === undefined) executor = new Executor()
    this.executor = executor
  }

  /**
   * Get the address of the server
   */
  public abstract get address(): Address

  /**
   * Handle a request
   *
   * @param request A JSON-RPC request from a client
   * @param stringify Should the response be stringified?
   * @returns A JSON-RPC response as an object or string (default)
   */
  protected async receive(
    request: string | JsonRpcRequest,
    stringify = true
  ): Promise<string | JsonRpcResponse> {
    let id = -1
    let result
    let error

    // Extract a parameter by name from Object or by index from Array
    function param(
      request: JsonRpcRequest,
      index: number,
      name: string,
      required = true
    ): any {
      if (request.params === undefined)
        throw new Error(-32600, 'Invalid request: missing "params" property')
      const value = Array.isArray(request.params)
        ? request.params[index]
        : request.params[name]
      if (required && value === undefined)
        throw new Error(-32602, `Invalid params: "${name}" is missing`)
      return value
    }

    try {
      if (request === null) {
        throw new Error(-32600, `Invalid request`)
      }

      if (typeof request === 'string') {
        // Parse JSON into a request
        try {
          request = JSON.parse(request) as JsonRpcRequest
        } catch (err) {
          throw new Error(-32700, `Parse error: ${err.message}`)
        }
      }

      // Response id is same as the request id
      id = request.id

      if (request.method === undefined)
        throw new Error(-32600, 'Invalid request: missing "method" property')

      switch (request.method) {
        case 'manifest':
          result = await this.executor.manifest()
          break
        case 'decode':
          result = await this.executor.decode(
            param(request, 0, 'content'),
            param(request, 1, 'format', false)
          )
          break
        case 'encode':
          result = await this.executor.encode(
            param(request, 0, 'node'),
            param(request, 1, 'format', false)
          )
          break
        case 'compile':
          result = await this.executor.compile(param(request, 0, 'node'))
          break
        case 'build':
          result = await this.executor.build(param(request, 0, 'node'))
          break
        case 'execute':
          result = await this.executor.execute(param(request, 0, 'node'))
          break
        default:
          throw new Error(-32601, `Method not found: "${request.method}"`)
      }
    } catch (exc) {
      error =
        exc instanceof Error
          ? exc
          : new Error(-32603, `Internal error: ${exc.message}`, {
              trace: exc.stack
            })
    }

    const response = new JsonRpcResponse(id, result, error)
    return stringify ? JSON.stringify(response) : response
  }

  /**
   * Start the server
   *
   * Derived classes may override this method.
   */
  public async start(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * Stop the server
   *
   * Derived classes may override this method.
   */
  public async stop(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * Run the server with graceful shutdown on `SIGINT` or `SIGTERM`
   */
  public async run(): Promise<void> {
    const stop = (): void => {
      this.stop()
        .then(() => process.exit())
        .catch(e => console.warn('Could not stop the server\n', e))
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    return this.start()
  }
}
