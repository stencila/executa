import { getLogger } from '@stencila/logga'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import jwt from 'jsonwebtoken'
import HttpServer from '../http/HttpServer'
import { WebSocketAddress, TcpAddressInitializer } from '../base/Transports'
import { Executor } from '../base/Executor'

const log = getLogger('executa:ws:server')

/**
 * A `Server` using WebSockets for communication.
 */
export default class WebSocketServer extends HttpServer {
  public constructor(
    executor?: Executor,
    address: WebSocketAddress = new WebSocketAddress()
  ) {
    super(executor, address)

    // Apply JWT-based authorization of each connection
    const secret = process.env.JWT_SECRET
    if (secret === undefined)
      throw new Error('Environment variable JWT_SECRET must be set')
    const authorize = (info: any, next: (ok: boolean) => void) => {
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
        // Register connection
        this.onConnection(connection)
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
