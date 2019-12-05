import { getLogger } from '@stencila/logga'
import schema from '@stencila/schema'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import WebSocket from 'isomorphic-ws'
import { Connection } from '../base/Connection'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  WebSocketAddress,
  WebSocketAddressInitializer,
  Transport
} from '../base/Transports'
import { HttpServer } from '../http/HttpServer'
import { send, isOpen, parseProtocol } from './util'
import { Claims } from '../base/Executor'
import { FastifyRequest, FastifyInstance } from 'fastify'

const log = getLogger('executa:ws:server')

/**
 * A WebSocket connection.
 */
export class WebSocketConnection implements Connection {
  /**
   * @implements Implements {@link Connection.id} to provide
   * a unique id for the WebSocket client.
   */
  id: string

  /**
   * Claims made for this connection
   */
  claims: Claims

  /**
   * The WebSocket used by this connection
   */
  socket: WebSocket

  constructor(socket: WebSocket, id: string, claims: Claims) {
    this.socket = socket
    this.id = id
    this.claims = { ...claims, client: { type: Transport.ws, id } }
  }

  /**
   * @implements Implements {@link Connection.notify} to send the
   * notification over the WebSocket.
   *
   * @description Will log an warning if the send failed for a
   * WebSocket that is still open (i.e. will ignore failures for
   * connections that are closing or have closed).
   */
  public notify(
    level: string,
    message: string,
    node: schema.Node
  ): Promise<void> {
    const notification = new JsonRpcRequest(level, { message, node }, false)
    const json = JSON.stringify(notification)
    try {
      return send(this.socket, json)
    } catch (error) {
      if (isOpen(this.socket))
        log.warn(
          `Failed to send notification to WebSocket connection: ${this.id}`
        )
    }
    return Promise.resolve()
  }

  /**
   * Send a response using the Websocket
   *
   * Will wait until the socket is open before
   * attempting to send the data.
   */
  public send(data: string): Promise<void> {
    return send(this.socket, data)
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
  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress({ port: 9000 }),
    jwtSecret?: string
  ) {
    super(address, jwtSecret)
  }

  /**
   * @override Overrides {@link HttpServer.buildApp} to add WebSocket
   * handling.
   */
  protected buildApp(): FastifyInstance {
    const app = super.buildApp()
    app.register(fastifyWebsocket, {
      handle: (connection: any, request: FastifyRequest) => {
        const { socket } = connection

        // Extract id and jwt from the protocol ('sec-websocket-protocol' header)
        // and verify the user jwt
        let id = ''
        let jwt
        try {
          ;({ id, jwt } = parseProtocol(socket.protocol))
        } catch (error) {
          log.warn(error)
        }
        let claims: Claims = {}
        if (jwt !== undefined) {
          try {
            claims = app.jwt.verify(jwt)
          } catch (error) {
            // If verification failed then close the connection
            // with a 4001 code (mirrors the HTTP 401 code used by `HttpServer`
            // in the same circumstance but in range assigned for application use
            // by the WebSockets API)
            socket.close(4001, error.message)
            return
          }
        }

        // Register connection and disconnection handler
        const wsconnection = new WebSocketConnection(socket, id, claims)
        this.onConnected(wsconnection)
        socket.on('close', () => this.onDisconnected(wsconnection))

        // Handle messages from connection
        socket.on('message', async (message: string) => {
          const response = await this.receive(message, wsconnection.claims)
          if (response !== undefined)
            wsconnection
              .send(response as string)
              .catch((error: Error) => log.error(error))
        })

        // Handle any errors
        socket.on('error', (error: Error) => log.error(error))
      }
    })
    return app
  }

  public get address(): WebSocketAddress {
    return new WebSocketAddress({
      host: this.host,
      port: this.port
    })
  }
}
