import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import crypto from 'crypto'
import WebSocket from 'isomorphic-ws'
import jsonwebtoken from 'jsonwebtoken'
import { Connection } from '../base/Connection'
import { Claims, Executor } from '../base/Executor'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  Addresses,
  Transport,
  WebSocketAddress,
  WebSocketAddressInitializer
} from '../base/Transports'
import { TcpServer } from '../tcp/TcpServer'
import { expandAddress } from '../tcp/util'
import { isOpen, parseProtocol, send } from './util'

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
export class WebSocketServer extends TcpServer {
  /**
   * The WebSocket server.
   */
  wsServer?: WebSocket.Server

  /**
   * The secret used to verify JWT tokens.
   *
   * If this is not provided to the constructor
   * then a random secret will be generated and
   * logged for use in generating tokens.
   */
  public readonly jwtSecret: string

  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress({ port: 9000 }),
    jwtSecret?: string
  ) {
    super(address)

    if (jwtSecret === undefined) {
      jwtSecret = crypto.randomBytes(16).toString('hex')
      log.info(`JWT secret generated for Websocket server: ${jwtSecret}`)
    }
    this.jwtSecret = jwtSecret
  }

  /**
   * @override Overrides {@link TcpServer.addresses}
   * to provide a WebSocket entry.
   */
  public async addresses(): Promise<Addresses> {
    return {
      [Transport.ws]: await expandAddress(this.address.url()),
    }
  }

  /**
   * @override Overrides {@link TcpServer.start} to start
   * a WebSocket server.
   */
  public start(executor: Executor): Promise<void> {
    this.executor = executor

    log.debug(`Starting Websocket server: ${this.address.url()}`)

    const [host, port] = this.listeningAddress()
    this.wsServer = new WebSocket.Server({ port, host })

    this.wsServer.on('connection', (socket: WebSocket) => {
      // Extract id and jwt from the protocol ('sec-websocket-protocol' header)
      // and verify the user jwt
      let id = ''
      let jwt
      if (socket.protocol !== undefined && socket.protocol.length > 0) {
        try {
          ;({ id, jwt } = parseProtocol(socket.protocol))
        } catch (error) {
          log.warn(error)
        }
      }

      let claims: Claims = {}
      if (jwt !== undefined) {
        try {
          claims = jsonwebtoken.verify(jwt, this.jwtSecret) as object
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
      const onMessage = async (message: string): Promise<void> => {
        const response = await this.receive(message, wsconnection.claims)
        if (response !== undefined) await wsconnection.send(response as string)
      }
      socket.on('message', (message: string) => {
        onMessage(message).catch((error: Error) => log.error(error))
      })

      // Handle any errors
      socket.on('error', (error: Error) => log.error(error))
    })

    return Promise.resolve()
  }

  /**
   * @override Overrides {@link TcpServer.stop} to stop the
   * WebSocket server.
   *
   * Calls `super.stop()` to close all connections.
   */
  public async stop(): Promise<void> {
    await super.stop()

    if (this.wsServer !== undefined) {
      log.debug(`Stopping WebSocket server: ${this.address.url()}`)
      this.wsServer.close()
    }

    return Promise.resolve()
  }
}
