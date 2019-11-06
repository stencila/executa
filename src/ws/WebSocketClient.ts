import WebSocket, { ErrorEvent, MessageEvent } from 'isomorphic-ws'

import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  WebSocketAddress,
  WebSocketAddressInitializer
} from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:ws:client')

/**
 * A `Client` using the WebSockets API for communication.
 */
export class WebSocketClient extends Client {
  /**
   * A `WebSocket` instance
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/WebSocket for
   * properties and methods.
   */
  private socket: WebSocket

  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress()
  ) {
    super()

    const wsAddress = new WebSocketAddress(address)
    const socket = (this.socket = new WebSocket(wsAddress.url(), wsAddress.jwt))

    socket.onerror = (error: ErrorEvent) => log.error(error.message)
    socket.onmessage = (event: MessageEvent) =>
      this.receive(event.data.toString())
  }

  protected async send(request: JsonRpcRequest): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise(resolve => {
        this.socket.onopen = () => resolve()
      })
    }
    const json = JSON.stringify(request)
    this.socket.send(json)
  }

  /**
   * @override Override of {@link Client.receive} to only
   * accept messages if the WebSocket is open
   */
  protected receive(message: string) {
    if (this.socket.readyState === WebSocket.OPEN) super.receive(message)
    else log.warn(`Message received while socket was closing: ${message}`)
  }

  public stop(): Promise<void> {
    this.socket.close()
    return Promise.resolve()
  }
}
