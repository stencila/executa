import { getLogger } from '@stencila/logga'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyCors from 'fastify-cors'
import fastifyJwt from 'fastify-jwt'
import jwt from 'jsonwebtoken'
import { Executor } from '../base/Executor'
import { BaseExecutor } from '../base/BaseExecutor'
import { InternalError } from '../base/InternalError'
import { JsonRpcErrorCode } from '../base/JsonRpcError'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { HttpAddress } from '../base/Transports'
import { TcpServer } from '../tcp/TcpServer'
import { JsonRpcResponse } from '../base/JsonRpcResponse'

const log = getLogger('executa:http:server')

/**
 * A `Server` using HTTP for communication.
 */
export class HttpServer extends TcpServer {
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

  public constructor(address: HttpAddress = new HttpAddress()) {
    super(address)

    // Define the routes
    const app = (this.app = fastify())

    // Register CORS plugin
    app.register(fastifyCors)

    // Register JWT plugin for all routes
    const secret = process.env.JWT_SECRET
    if (secret === undefined)
      throw new InternalError('Environment variable JWT_SECRET must be set')
    app.register(fastifyJwt, {
      secret
    })
    app.addHook('onRequest', async (request, reply) => {
      // In development do not require a JWT for /mainfest (so the clinet can obtain a JWT!;)
      if (process.env.NODE_ENV === 'development') return
      // In all other cases, a valid JWT is required
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
        const jsonRpcRequest = new JsonRpcRequest(method, request.body)
        const jsonRpcResponse = await this.receive(jsonRpcRequest, false)

        reply.header('Content-Type', 'application/json')
        const { result, error } = jsonRpcResponse as JsonRpcResponse
        if (error !== undefined)
          reply
            .status(error.code < JsonRpcErrorCode.InternalError ? 400 : 500)
            .send({ error: error })
        else reply.send(result)
      }
    }
    app.post('/manifest', wrap('manifest'))
    app.post('/decode', wrap('decode'))
    app.post('/encode', wrap('encode'))
    app.post('/compile', wrap('compile'))
    app.post('/build', wrap('build'))
    app.post('/execute', wrap('execute'))
    app.post('/begin', wrap('begin'))
    app.post('/end', wrap('end'))

    this.server = app.server
  }

  public get address(): HttpAddress {
    return new HttpAddress(
      {
        host: this.host,
        port: this.port
      },
      '',
      this.defaultJwt
    )
  }

  public async start(executor?: Executor): Promise<void> {
    if (executor === undefined) executor = new BaseExecutor()
    this.executor = executor

    const url = this.address.toString()
    log.info(`Starting server: ${url}`)
    return new Promise(resolve =>
      this.app.listen(this.port, this.host, () => {
        // Set server property to use `TcpServer.stop()`
        this.server = this.app.server
        log.info(
          `Started server: ${url}. To connect add header:\n  Authorization: Bearer ${this.defaultJwt}`
        )
        resolve()
      })
    )
  }
}
