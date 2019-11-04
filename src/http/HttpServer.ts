import { getLogger } from '@stencila/logga'
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyError
} from 'fastify'
import fastifyCors from 'fastify-cors'
import fastifyJwt from 'fastify-jwt'
import jwt from 'jsonwebtoken'
import { Executor } from '../base/Executor'
import { BaseExecutor } from '../base/BaseExecutor'
import { InternalError } from '../base/InternalError'
import { JsonRpcErrorCode, JsonRpcError } from '../base/JsonRpcError'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { HttpAddress, HttpAddressInitializer } from '../base/Transports'
import { TcpServer } from '../tcp/TcpServer'
import { JsonRpcResponse } from '../base/JsonRpcResponse'

const log = getLogger('executa:http:server')

/**
 * A `Server` for the HTTP transport.
 *
 * This server class performs JSON-RPC over HTTP.
 *
 * For the `/` endpoint, the request body should be
 * an JSON-RPC request and the response body will be
 * a JSON-RPC request.
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

  public constructor(
    address: HttpAddressInitializer = new HttpAddress({ port: 8000 })
  ) {
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
    this.defaultJwt = jwt.sign({}, secret)

    // Set custom, override-able, hooks and handlers
    app.addHook('onRequest', (request, reply) => this.onRequest(request, reply))
    app.setErrorHandler((error, request, reply) =>
      this.errorHandler(error, request, reply)
    )
    app.setNotFoundHandler((request, reply) =>
      this.notFoundHandler(request, reply)
    )

    // JSON-RPC over HTTP
    // No wrapping/unwrapping of the request/response or
    // special handling of errors. Just JSON-RPC requests and responses
    // in the bodies.
    app.post('/', async (request, reply) => {
      reply.header('Content-Type', 'application/json')
      // @ts-ignore that user does not exist on request
      const { body, user = {} } = request
      reply.send(await this.receive(body, user, false))
    })

    // RESTful-like JSON-RPC wrapped in HTTP
    // Wrap the HTTP request into a JSON-RPC request and
    // unwrap the JSON-RPC response as HTTP response with
    // bare, unenveloped results and errors
    const wrap = (method: string) => {
      return async (request: FastifyRequest, reply: FastifyReply<any>) => {
        // @ts-ignore that user does not exist on request
        const { body, user = {} } = request
        const jsonRpcRequest = new JsonRpcRequest(method, body)
        const jsonRpcResponse = await this.receive(jsonRpcRequest, user, false)

        reply.header('Content-Type', 'application/json')
        const { result, error } = jsonRpcResponse as JsonRpcResponse
        if (error !== undefined) {
          // Send bare error
          reply
            .status(error.code < JsonRpcErrorCode.InternalError ? 400 : 500)
            .send(error)
        } else {
          // Send bare result
          reply.send(result)
        }
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

  /**
   * Hook that performs JWT verification on each request
   */
  protected async onRequest(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): Promise<void> {
    // In development do not require a JWT (so the client can obtain a JWT!;)
    if (process.env.NODE_ENV === 'development') return

    // In all other cases, a valid JWT is required
    try {
      await request.jwtVerify()
    } catch (err) {
      log.warn(`JWT verification failed`)
      reply
        .status(403)
        .send(
          jsonRpcErrorResponse(
            JsonRpcErrorCode.InvalidRequest,
            'JWT verification failed'
          )
        )
    }
  }

  /**
   * Custom 404 handler which returns a JSON-RPC error
   * (not wrapped in a JSON-RPC response) intended as a reply
   * to wrong RESTful-like routes e.g. `/exec` instead of `/execute`
   */
  protected notFoundHandler(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): void {
    reply
      .status(404)
      .send(
        new JsonRpcError(
          JsonRpcErrorCode.InvalidRequest,
          `Route not found: "${request.req.url}"`
        )
      )
  }

  /**
   * Custom error handler to return a JSON-RPC response
   * with an `error` property.
   */
  protected errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): void {
    const { statusCode, message } = error
    reply
      .status(statusCode !== undefined ? statusCode : 500)
      .send(
        jsonRpcErrorResponse(
          JsonRpcErrorCode.ServerError,
          `Server error: "${message}"`
        )
      )
  }

  public get address(): HttpAddress {
    return new HttpAddress({
      host: this.host,
      port: this.port,
      jwt: this.defaultJwt
    })
  }

  public async start(executor?: Executor): Promise<void> {
    if (executor === undefined) executor = new BaseExecutor()
    this.executor = executor

    const url = this.address.url()
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

function jsonRpcErrorResponse(code: JsonRpcErrorCode, message: string) {
  return new JsonRpcResponse(
    undefined,
    undefined,
    new JsonRpcError(code, message)
  )
}
