import { getLogger } from '@stencila/logga'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from 'fastify-jwt'
import jwt from 'jsonwebtoken'
import Executor from '../base/Executor'
import Request from '../base/Request'
import Response from '../base/Response'
import { HttpAddress } from '../base/Transports'
import TcpServer from '../tcp/TcpServer'

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
  protected app: FastifyInstance

  /**
   * Default JWT
   *
   * This allows for connection to this server
   * but holds no capabilities. Mainly used for
   * testing.
   */
  protected defaultJwt: string

  public constructor(
    executor?: Executor,
    address: HttpAddress = new HttpAddress()
  ) {
    super(executor, address)

    // Define the routes
    const app = (this.app = fastify())

    // Register JWT plugin for all routes
    const secret = process.env.JWT_SECRET
    if (secret === undefined)
      throw new Error('Environment variable JWT_SECRET must be set')
    app.register(fastifyJwt, {
      secret
    })
    app.addHook('onRequest', async (request, reply) => {
      try {
        await request.jwtVerify()
      } catch (err) {
        log.warn(`JWT verification failed`)
        reply.status(403).send('JSON Web Token verification failed')
      }
    })
    this.defaultJwt = jwt.sign({}, secret)

    // JSON-RPC over HTTP used by `HttpClient`
    // No wrapping/unwrapping of the request/response or
    // special handling of errors. Just JSON-RPC requests and responses
    // in the bodies.
    app.post('/', async (request, reply) => {
      reply.header('Content-Type', 'application/json')
      reply.send(await this.receive(request.body, false))
    })

    // JSON-RPC wrapped in HTTP for other clients
    // Unwrap the HTTP request into a JSON-RPC request and
    // unwrap the JSON-RPC response as HTTP with bare results
    // and HTTP error codes
    const wrap = (method: string) => {
      return async (request: FastifyRequest, reply: FastifyReply<any>) => {
        const jsonRpcRequest = new Request(method, request.body)
        const jsonRpcResponse = (await this.receive(
          jsonRpcRequest,
          false
        )) as Response

        reply.header('Content-Type', 'application/json')
        const { result, error } = jsonRpcResponse
        if (error !== undefined)
          reply.status(error.code < -32603 ? 400 : 500).send({ error: error })
        else reply.send(result)
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

  public get address(): HttpAddress {
    return new HttpAddress(
      {
        host: this.host,
        port: this.port
      },
      this.defaultJwt
    )
  }

  public async start(): Promise<void> {
    log.info(`Starting server: ${this.address.toString()}`)
    return new Promise(resolve =>
      this.app.listen(this.port, this.host, () => resolve())
    )
  }
}
