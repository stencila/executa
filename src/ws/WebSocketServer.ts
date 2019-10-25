import { getLogger } from '@stencila/logga'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import jwt from 'jsonwebtoken'
import { InternalError } from '../base/InternalError'
import { WebSocketAddress } from '../base/Transports'
import { HttpServer } from '../http/HttpServer'

const log = getLogger('executa:ws:server')

/**
 * A `Server` using WebSockets for communication.
 */
export class WebSocketServer extends HttpServer {
  public constructor(address: WebSocketAddress = new WebSocketAddress()) {
    super(address)

    // Apply JWT-based authorization of each connection
    const secret = process.env.JWT_SECRET
    if (secret === undefined)
      throw new InternalError('Environment variable JWT_SECRET must be set')
    const authorize = (info: any, next: (ok: boolean) => void): void => {
      const token = info.req.headers['sec-websocket-protocol']
      if (token !== undefined) {
        try {
          jwt.verify(token, secret)
          next(true)
        } catch {
          next(false)
        }
      } else next(false)
    }

    this.app.register(fastifyWebsocket, {
      handle: (connection: any) => {
        const { socket } = connection
        // Handle messages from connection
        socket.on('message', async (message: string) => {
          socket.send(await this.receive(message))
        })
        // Register connection and disconnection handler
        this.onConnected(connection)
        socket.on('close', () => this.onDisconnected(connection))
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
}
