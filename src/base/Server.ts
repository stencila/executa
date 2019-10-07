import * as stencila from '@stencila/schema'
import Error from './Error'
import Executor from './Executor'
import Request from './Request'
import Response from './Response'

/**
 * A base server class that passes JSON-RPC requests
 * from `Client`s to a `Executor`.
 */
export default abstract class Server {

  /**
   * The executor that this server dispatches to.
   */
  executor: Executor

  constructor (executor?: Executor) {
    if (executor === undefined) executor = new Executor()
    this.executor = executor
  }

  /**
   * Handle a request
   *
   * @param request A JSON-RPC request from a client
   * @param stringify Should the response be stringified?
   * @returns A JSON-RPC response as an object or string (default)
   */
  async receive (request: string | Request, stringify: boolean = true): Promise<string | Response> {
    const response = new Response(-1)

    // Extract a parameter by name from Object or by index from Array
    function param (request: Request, index: number, name: string, required: boolean = true) {
      if (!request.params) throw new Error(-32600, 'Invalid request: missing "params" property')
      const value = Array.isArray(request.params) ? request.params[index] : request.params[name]
      if (required && value === undefined) throw new Error(-32602, `Invalid params: "${name}" is missing`)
      return value
    }

    try {
      if (typeof request === 'string') {
        // Parse JSON into an request
        try {
          request = JSON.parse(request) as Request
        } catch (err) {
          throw new Error(-32700, 'Parse error: ' + err.message)
        }
      }

      // Response id is same as the request id
      response.id = request.id

      if (!request.method) throw new Error(-32600, 'Invalid request: missing "method" property')

      let result
      switch (request.method) {
        case 'capabilities':
          result = await this.executor.capabilities()
          break
        case 'convert':
          result = await this.executor.convert(
            param(request, 0, 'node'),
            param(request, 1, 'from', false),
            param(request, 2, 'to', false)
          )
          break
        case 'compile':
          result = await this.executor.compile(
            param(request, 0, 'node'),
            param(request, 1, 'format', false)
          )
          break
        case 'build':
          result = await this.executor.build(
            param(request, 0, 'node'),
            param(request, 1, 'format', false)
          )
          break
        case 'execute':
          result = await this.executor.execute(
            param(request, 0, 'node'),
            param(request, 1, 'format', false)
          )
          break
        default:
          throw new Error(-32601, `Method not found: "${request.method}"`)
      }
      response.result = result
    } catch (exc) {
      response.error = (exc instanceof Error) ? exc : new Error(-32603, `Internal error: ${exc.message}`, { trace: exc.stack })
    }

    return stringify ? JSON.stringify(response) : response
  }

  /**
   * Start the server
   */
  abstract start (): void

  /**
   * Stop the server
   */
  abstract stop (): void

  /**
   * Run the server with graceful shutdown on `SIGINT` or `SIGTERM`
   */
  run () {
    if (process !== undefined) {
      const stop = () => this.stop()
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    }
    this.start()
  }
}
