import Error from './Error'
import Executor from './Executor'
import Request from './Request'
import Response from './Response'
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

  public abstract address(): Address

  /**
   * Handle a request
   *
   * @param request A JSON-RPC request from a client
   * @param stringify Should the response be stringified?
   * @returns A JSON-RPC response as an object or string (default)
   */
  protected async receive(
    request: string | Request,
    stringify: boolean = true
  ): Promise<string | Response> {
    let id = -1
    let result
    let error

    // Extract a parameter by name from Object or by index from Array
    function param(
      request: Request,
      index: number,
      name: string,
      required: boolean = true
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
      if (typeof request === 'string') {
        // Parse JSON into an request
        try {
          request = JSON.parse(request) as Request
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

    const response = new Response(id, result, error)
    return stringify ? JSON.stringify(response) : response
  }

  /**
   * Start the server
   */
  public abstract start(): void

  /**
   * Stop the server
   */
  public abstract stop(): void

  /**
   * Run the server with graceful shutdown on `SIGINT` or `SIGTERM`
   */
  public run(): void {
    if (process !== undefined) {
      const stop = (): void => this.stop()
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    }
    this.start()
  }
}
