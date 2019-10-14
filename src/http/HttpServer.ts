import { getLogger } from '@stencila/logga'
import fastify from 'fastify'
import Executor from '../base/Executor'
import Request from '../base/Request'
import Response from '../base/Response'
import TcpServer from '../tcp/TcpServer'
import {
  HttpAddress,
  TcpAddressInitializer,
  TcpAddress
} from '../base/Transports'

const log = getLogger('executa:http:server')

/**
 * A `Server` using HTTP for communication.
 */
export default class HttpServer extends TcpServer {
  /**
   * The Fastify application
   *
   * Used by derived classes to add routes.
   */
  protected app: fastify.FastifyInstance

  public constructor(executor?: Executor, address?: TcpAddressInitializer) {
    super(
      executor,
      address instanceof TcpAddress ? address : new HttpAddress(address)
    )

    // Define the routes
    const app = (this.app = fastify())

    // JSON-RPC over HTTP used by `HttpClient`
    // No wrapping/unwrapping of the request/response or
    // special handling of errors. Just JSON-RPC requests and responses
    // in the bodies.
    app.post('/', async (req, res) => {
      res.header('Content-Type', 'application/json')
      res.send(await this.receive(req.body, false))
    })

    // JSON-RPC wrapped in HTTP for other clients
    // Unwrap the HTTP request into a JSON-RPC request and
    // unwrap the JSON-RPC response as HTTP with bare results
    // and HTTP error codes
    const wrap = (method: string) => {
      return async (req: any, res: any) => {
        const request = new Request(method, req.body)
        const response = (await this.receive(request, false)) as Response
        res.header('Content-Type', 'application/json')
        if (response.error !== undefined)
          res
            .status(response.error.code < -32603 ? 400 : 500)
            .send({ error: response.error })
        else res.send(response.result)
      }
    }
    app.post('/manifest', wrap('manifest'))
    app.post('/decode', wrap('decode'))
    app.post('/encode', wrap('encode'))
    app.post('/compile', wrap('compile'))
    app.post('/build', wrap('build'))
    app.post('/execute', wrap('execute'))

    this.server = app.server
  }

  public async start() {
    log.info(`Starting server: ${this.address.toString()}`)
    await this.app.listen(this.address.port)
  }
}
