import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import {
  WebSocketAddress,
  WebSocketAddressInitializer
} from '../base/Transports'
import { HttpServer } from '../http/HttpServer'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { Connection } from '../base/Connection'
import { Node } from '@stencila/schema'

const log = getLogger('executa:ws:server')

/**
 * A WebSocket connection.
 */
export class WebSocketConnection implements Connection {
  /**
   * @implements Implements {@link Connection.id} to provide
   * a unique id for the WebSocket connection.
   */
  id: string = crypto.randomBytes(32).toString('hex')

  /**
   * The WebSocket used by this connection
   */
  socket: WebSocket

  constructor(socket: WebSocket) {
    this.socket = socket
  }

  /**
   * @implements Implements {@link Connection.notify} to send the
   * notification over the WebSocket.
   *
   * @description Will log an error if the send failed for a
   * WebSocket that is still open (i.e. will ignore failures for
   * connections that are closing or have closed).
   */
  public notify(level: string, message: string, node: Node): void {
    const notification = new JsonRpcRequest(level, { message, node }, false)
    const json = JSON.stringify(notification)
    try {
      this.socket.send(json)
    } catch (error) {
      if (this.socket.readyState !== this.socket.OPEN)
        log.warn(
          `Failed to send notification to WebSocket connection: ${this.id}`
        )
    }
  }

  /**
   * @implements Implements {@link Connection.stop} by closing the WebSocket.
   */
  public stop(): Promise<void> {
    this.socket.close()
    return Promise.resolve()
  }
}

/**
 * A `Server` using WebSockets as the transport protocol.
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

  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress({ port: 9000 })
  ) {
    super(address)

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
        const wsconnection = new WebSocketConnection(socket)
        this.onConnected(wsconnection)
        socket.on('close', () => {
          this.onDisconnected(wsconnection)
          delete this.users[token]
        })

        // Handle messages from connection
        socket.on('message', async (message: string) => {
          const response = await this.receive(message, {
            // The `user` argument is a merging of the JWT
            // payload and client identification info.
            ...user,
            client: {
              type: 'ws',
              id: wsconnection.id
            }
          })
          if (response !== undefined) socket.send(response)
        })

        // Handle any errors
        socket.on('error', (error: Error) => log.error(error))
      },
      options: {
        verifyClient: (info: any, next: (ok: boolean) => void): void => {
          const { headers } = info.req
          const token = headers['sec-websocket-protocol']
          if (token === undefined) return next(false)
          try {
            this.users[token] = this.app.jwt.verify(token)
            next(true)
          } catch {
            next(false)
          }
        }
      }
    })
  }

  public get address(): WebSocketAddress {
    return new WebSocketAddress({
      host: this.host,
      port: this.port,
      jwt: this.defaultJwt
    })
  }
}
