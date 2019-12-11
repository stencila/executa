import { getLogger } from '@stencila/logga'
import WebSocket, { CloseEvent, ErrorEvent, MessageEvent } from 'isomorphic-ws'
import retry from 'p-retry'
import { Client } from '../base/Client'
import { generate } from '../base/uid'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  WebSocketAddress,
  WebSocketAddressInitializer
} from '../base/Transports'
import { isOpen, send, generateProtocol } from './util'

const log = getLogger('executa:ws:client')

interface WebSocketClientOptions {
  /**
   * Should logging of connection errors etc be done?
   */
  logging: boolean

  /**
   * Seconds to wait for connection to be open
   * before sending a message.
   */
  timeout: number

  /**
   * Number of attempts to reconnect if
   * the connection is closed.
   */
  retries: number
}

const defaultWebSocketClientOptions: WebSocketClientOptions = {
  logging: true,
  timeout: 60,
  retries: 10
}

/**
 * A `Client` using the WebSockets API for communication.
 */
export class WebSocketClient extends Client {
  /**
   * The address that this client connects to.
   */
  public readonly address: WebSocketAddress

  /**
   * Options for this client.
   */
  public readonly options: WebSocketClientOptions

  /**
   * The `WebSocket` instance used for connections.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/WebSocket for
   * properties and methods.
   */
  private socket?: WebSocket

  /**
   * Has this client been explicitly stopped.
   *
   * Used to determine whether to try to reconnect.
   */
  private stopped = false

  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress(),
    options: Partial<WebSocketClientOptions> = defaultWebSocketClientOptions
  ) {
    super('ws')
    this.address = new WebSocketAddress(address)
    this.options = { ...defaultWebSocketClientOptions, ...options }
    this.start().catch(error => log.error(error))
  }

  /**
   * Start the connection.
   *
   * Creates a new WebSocket and sets up event handlers including
   * for automatically reconnecting if the connection is closed.
   */
  public start(): Promise<void> {
    const {
      id,
      address,
      options: { retries, logging }
    } = this
    const socket = (this.socket = new WebSocket(
      address.url(),
      generateProtocol(id, address.jwt)
    ))
    socket.onmessage = (event: MessageEvent) =>
      this.receive(event.data.toString())
    socket.onclose = (event: CloseEvent) => {
      // Try to reconnect if not explicitly closed or if
      // authentication failed
      if (this.stopped === true) return
      const { code, reason } = event
      if (code === 4001) {
        if (logging) log.error(`Failed to authenticate with server: ${reason}`)
        return
      }
      if (retries > 0) {
        if (logging) log.info(`Connection closed, trying to reconnect`)
        retry(() => this.start(), {
          retries,
          randomize: true
        }).catch(error => log.error(error))
      }
    }
    socket.onerror = (error: ErrorEvent) => {
      if (logging) log.error(error.message)
    }
    this.stopped = false
    return Promise.resolve()
  }

  /**
   * @implements Implements {@link Client.send} to send
   * the request using the Websocket
   *
   * @description Will wait until the socket is open before
   * attempting to send the data.
   */
  protected async send(request: JsonRpcRequest): Promise<void> {
    const {
      socket,
      options: { timeout }
    } = this
    if (socket === undefined) {
      await this.start()
      return this.send(request)
    }
    return send(socket, JSON.stringify(request), timeout)
  }

  /**
   * @override Override of {@link Client.receive} to only
   * accept messages if the WebSocket is open.
   */
  protected receive(message: string): void {
    const {
      socket,
      options: { logging }
    } = this
    if (socket === undefined) return
    if (isOpen(socket)) super.receive(message)
    else if (logging)
      log.warn(`Message received while socket was closing: ${message}`)
  }

  /**
   * Stop the connection by closing the WebSocket.
   */
  public stop(): Promise<void> {
    this.stopped = true
    if (this.socket !== undefined) this.socket.close()
    return Promise.resolve()
  }

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Not implemented yet. In the future
   * could be implemented using port scanning on the
   * localhost.
   */
  static discover(): Promise<WebSocketClient[]> {
    log.warn('Discovery not available for WebSocket client')
    return Promise.resolve([])
  }
}
