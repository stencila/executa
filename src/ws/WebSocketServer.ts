import { getLogger } from '@stencila/logga'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import jwt from 'jsonwebtoken'
import { InternalError } from '../base/InternalError'
import { WebSocketAddress } from '../base/Transports'
import { HttpServer } from '../http/HttpServer'
import { TcpServerClient, tcpServerClient } from '../tcp/TcpServer'

const log = getLogger('executa:ws:server')

/**
 * A `Server` using WebSockets for communication.
 */
export class WebSocketServer extends HttpServer {
  /**
   * A map of JWT tokens to their payload.
   *
   * This is necessary, because we need to keep provide the
   * JWT payload to `this.executor` on each message.
   * In `HttpServer` this is easy because the payload is
   * attached to the request as the `user` property.
   * Here, we need to do the association ourselves.
   */
  users: { [key: string]: any } = {}

  public constructor(address: WebSocketAddress = new WebSocketAddress()) {
    super(address)

    // Verify the JWT for each connection and store
    // it's payload so it can be used against each
    // subsequent request message.
    const secret = process.env.JWT_SECRET
    if (secret === undefined)
      throw new InternalError('Environment variable JWT_SECRET must be set')
    const authorize = (info: any, next: (ok: boolean) => void): void => {
      const { headers } = info.req
      const token = headers['sec-websocket-protocol']
      if (token === undefined) return next(false)
      try {
        this.users[token] = jwt.verify(token, secret)
        next(true)
      } catch {
        next(false)
      }
    }

    this.app.register(fastifyWebsocket, {
      handle: (connection: any) => {
        const { socket } = connection

        const token = socket.protocol
        const user = this.users[token]
        if (user === undefined) {
          // This should not happen
          log.error('Unable to get user for connection')
        }

        // Register connection and disconnection handler
        const client = tcpServerClient(connection)
        this.onConnected(client)
        socket.on('close', () => this.onDisconnected(client, token))

        // Handle messages from connection
        socket.on('message', async (message: string) => {
          const response = await this.receive(message, {
            // The `user` argument is a merging of the JWT
            // payload and client identification info.
            ...user,
            client: {
              id: client.id,
              type: 'ws'
            }
          })
          socket.send(response)
        })
      },
      options: {
        verifyClient: authorize
      }
    })
  }

  public get address(): WebSocketAddress {
    return new WebSocketAddress(
      {
        host: this.host,
        port: this.port
      },
      '',
      this.defaultJwt
    )
  }

  /**
   * When a client disconnects, remove it's payload
   * from `this.users`.
   *
   * @param client The client socket
   * @param token The JWT token
   */
  protected onDisconnected(client: TcpServerClient, token?: string): void {
    super.onDisconnected(client)
    if (token !== undefined) delete this.users[token]
  }
}
