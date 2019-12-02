import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyError
} from 'fastify'
import fastifyCors from 'fastify-cors'
import fastifyJwt from 'fastify-jwt'
import { Executor } from '../base/Executor'
import { Manager } from '../base/Manager'
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
   * The Fastify application.
   *
   * Used by derived classes to add routes.
   */
  protected app?: FastifyInstance

  /**
   * The secret used to decode JWT tokens.
   *
   * If this is not provided to the constructor
   * then a random secret will be generated and
   * logged for use in generating tokens.
   */
  public readonly jwtSecret: string

  public constructor(
    address: HttpAddressInitializer = new HttpAddress({ port: 8000 }),
    jwtSecret?: string
  ) {
    super(address)

    if (jwtSecret === undefined) {
      jwtSecret = crypto.randomBytes(16).toString('hex')
      log.info(`JWT secret generated for ${this.address.url()}: ${jwtSecret}`)
    }
    this.jwtSecret = jwtSecret
  }

  /**
   * Build the Fastify app.
   *
   * Derived classes may want to override this method
   * to extend the set of endpoints etc.
   */
  protected buildApp(): FastifyInstance {
    // Define the routes
    const app = fastify()

    // Register CORS plugin
    app.register(fastifyCors)

    // Register JWT plugin
    app.register(fastifyJwt, { secret: this.jwtSecret })

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
    app.get('/manifest', wrap('manifest'))
    app.post('/manifest', wrap('manifest'))
    app.post('/decode', wrap('decode'))
    app.post('/encode', wrap('encode'))
    app.post('/compile', wrap('compile'))
    app.post('/build', wrap('build'))
    app.post('/execute', wrap('execute'))
    app.post('/begin', wrap('begin'))
    app.post('/end', wrap('end'))

    return app
  }

  /**
   * Hook that performs JWT verification on each request
   */
  protected async onRequest(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): Promise<void> {
    const { headers, query } = request
    // If there is no `Authorization` header...
    if (headers.authorization === undefined) {
      // but there is a `jwt` query parameter, then use that
      if (query.jwt !== undefined)
        request.headers.authorization = `Bearer ${query.jwt}`
      // otherwise no JWT verification to do
      else return
    }

    try {
      await request.jwtVerify()
    } catch (error) {
      // Send "Unauthorized" response if there was JWT, but it is
      // not valid
      reply
        .status(401)
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
      port: this.port
    })
  }

  public async start(executor?: Executor): Promise<void> {
    if (executor === undefined) executor = new Manager()
    this.executor = executor

    const url = this.address.url()
    log.info(`Starting server: ${url}`)

    const app = (this.app = this.buildApp())

    // Wait for plugins to be ready
    await app.ready()

    // Start listening
    await app.listen(this.port, this.host)
  }

  /**
   * @override Overrides {@link TcpServer.stop} to close
   * Fastify app.
   */
  public async stop(): Promise<void> {
    await super.stop()
    if (this.app !== undefined) {
      await this.app.close()
      delete this.app
    }
  }
}

function jsonRpcErrorResponse(code: JsonRpcErrorCode, message: string) {
  return new JsonRpcResponse(
    undefined,
    undefined,
    new JsonRpcError(code, message)
  )
}
