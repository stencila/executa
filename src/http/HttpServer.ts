import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyError,
} from 'fastify'
import fastifyCors from 'fastify-cors'
import fastifyJwt from 'fastify-jwt'
import fastifyStatic from 'fastify-static'
import { Executor } from '../base/Executor'
import { JsonRpcErrorCode, JsonRpcError } from '../base/JsonRpcError'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  HttpAddress,
  HttpAddressInitializer,
  Transport,
  Addresses,
} from '../base/Transports'
import path from 'path'
import { TcpServer } from '../tcp/TcpServer'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { expandAddress } from '../tcp/util'

const log = getLogger('executa:http:server')

// Typescript seems to think that some of the `Fastify.Reply`
// methods e.g. `headers`, `send`, return promises when they don't
/* eslint-disable @typescript-eslint/no-floating-promises */

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
      log.info(`JWT secret generated for HTTP server: ${jwtSecret}`)
    }
    this.jwtSecret = jwtSecret
  }

  /**
   * @override Overrides {@link TcpServer.addresses}
   * to provide a HTTP entry.
   */
  public async addresses(): Promise<Addresses> {
    return {
      [Transport.http]: await expandAddress(this.address.url()),
    }
  }

  /**
   * Build the Fastify app.
   *
   * Derived classes may want to override this method
   * to extend the set of endpoints etc.
   */
  protected async buildApp(): Promise<FastifyInstance> {
    // Define the routes
    const app = fastify({
      ignoreTrailingSlash: true,
    })

    // Register CORS plugin
    await app.register(fastifyCors)

    // Register JWT plugin
    await app.register(fastifyJwt, { secret: this.jwtSecret })

    // Register static file serving plugin
    await app.register(fastifyStatic, {
      root: path.join(__dirname, 'static'),
    })

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
      const { body, user } = request
      if (typeof body === 'object' && body !== null && 'jsonrpc' in body) {
        const jsonRpcRequest = body as JsonRpcRequest
        const claims = typeof user === 'object' ? user : {}
        const jsonRpcResponse = await this.receive(
          jsonRpcRequest,
          claims,
          false
        )
        reply.send(jsonRpcResponse)
      } else {
        reply.status(400).send('Request body must be a JSON-RPC request')
      }
    })

    // RESTful-like JSON-RPC wrapped in HTTP
    // Wrap the HTTP request into a JSON-RPC request and
    // unwrap the JSON-RPC response as HTTP response with
    // bare, un-enveloped results and errors
    const wrap = (method: string) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const { body, user } = request
        const claims = typeof user === 'object' ? user : {}
        const jsonRpcRequest = new JsonRpcRequest(
          method,
          body as Record<string, unknown>
        )
        const jsonRpcResponse = await this.receive(
          jsonRpcRequest,
          claims,
          false
        )

        reply.header('Content-Type', 'application/json')
        const { result, error } = jsonRpcResponse as JsonRpcResponse
        if (error !== undefined) {
          // Send bare error
          reply
            .status(error.code < JsonRpcErrorCode.InternalError ? 400 : 500)
            .send(error)
        } else {
          // Send bare result
          // To to fastify's (change in) handling of strings it is necessary
          // to stringify them before sending.
          // See https://github.com/stencila/executa/pull/95#issuecomment-591054049
          reply.send(typeof result === 'string' ? `"${result}"` : result)
        }
      }
    }
    app.get('/manifest', wrap('manifest'))
    app.post('/manifest', wrap('manifest'))
    app.post('/decode', wrap('decode'))
    app.post('/encode', wrap('encode'))
    app.post('/query', wrap('query'))
    app.post('/compile', wrap('compile'))
    app.post('/build', wrap('build'))
    app.post('/execute', wrap('execute'))
    app.post('/begin', wrap('begin'))
    app.post('/end', wrap('end'))
    app.post('/pipe', wrap('pipe'))
    app.post('/cancel', wrap('cancel'))

    return app
  }

  /**
   * Hook that performs JWT verification on each request
   */
  protected async onRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { headers } = request
    const query = request.query as Record<string, string>
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
    reply: FastifyReply
  ): void {
    reply
      .status(404)
      .send(
        new JsonRpcError(
          JsonRpcErrorCode.InvalidRequest,
          `Route not found: ${request.method} ${request.url}`
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
    reply: FastifyReply
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

  public async start(executor: Executor): Promise<void> {
    this.executor = executor

    log.debug(`Starting server: ${this.address.url()}`)
    const app = (this.app = await this.buildApp())

    // Wait for plugins to be ready
    await app.ready()

    // Start listening
    const [host, port] = this.listeningAddress()
    await app.listen(port, host)
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

/**
 * Generate a JSON-RPC response with only an error.
 *
 * This is only used to send an error when the server has not yet,
 * or does not want to, resolve the is of the request.
 */
function jsonRpcErrorResponse(
  code: JsonRpcErrorCode,
  message: string
): JsonRpcResponse {
  return new JsonRpcResponse('', undefined, new JsonRpcError(code, message))
}
