import { getLogger } from '@stencila/logga'
import WebSocket, { CloseEvent, ErrorEvent, MessageEvent } from 'isomorphic-ws'
import retry from 'p-retry'
import { Client } from '../base/Client'
import { uid } from '../base/uid'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  WebSocketAddress,
  WebSocketAddressInitializer
} from '../base/Transports'
import { isOpen, send } from './util'

const log = getLogger('executa:ws:client')

/**
 * A `Client` using the WebSockets API for communication.
 */
export class WebSocketClient extends Client {
  /**
   * The address that this client connects to.
   */
  public readonly address: WebSocketAddress

  /**
   * A unique identifier for this client.
   */
  public readonly id: string

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
    id: string = uid()
  ) {
    super()
    this.address = new WebSocketAddress(address)
    this.id = id
    this.start().catch(error => log.error(error))
  }

  /**
   * Start the connection.
   *
   * Creates a new WebSocket and sets up event handlers including
   * for automatically reconnecting if the connection is closed.
   */
  public start(): Promise<void> {
    const protocol = `${this.id}:${this.address.jwt}`
    const socket = (this.socket = new WebSocket(this.address.url(), protocol))
    socket.onmessage = (event: MessageEvent) =>
      this.receive(event.data.toString())
    socket.onclose = (event: CloseEvent) => {
      // Try to reconnect if not explicitly closed or if
      // authentication failed
      if (this.stopped === true) return
      const { code, reason } = event
      if (code === 4001) {
        log.error(`Failed to authenticate with server: ${reason}`)
        return
      }
      log.info(`Connection closed, trying to reconnect`)
      retry(() => this.start(), {
        randomize: true
      }).catch(error => log.error(error))
    }
    socket.onerror = (error: ErrorEvent) => {
      log.error(error.message)
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
    if (this.socket === undefined) {
      await this.start()
      return this.send(request)
    }
    return send(this.socket, JSON.stringify(request))
  }

  /**
   * @override Override of {@link Client.receive} to only
   * accept messages if the WebSocket is open.
   */
  protected receive(message: string): void {
    if (this.socket === undefined) return
    if (isOpen(this.socket)) super.receive(message)
    else log.warn(`Message received while socket was closing: ${message}`)
  }

  /**
   * Stop the connection by closing the WebSocket.
   */
  public stop(): Promise<void> {
    this.stopped = true
    if (this.socket !== undefined) this.socket.close()
    return Promise.resolve()
  }
}
