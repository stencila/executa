import WebSocket from 'isomorphic-ws'

import Client from '../base/Client'
import Request from '../base/Request'
import { WebSocketAddress, TcpAddressInitializer } from '../base/Transports'

/**
 * A `Client` using the WebSockets API for communication.
 */
export default class WebSocketClient extends Client {
  /**
   * The address of the `WebSocketServer`
   */
  private address: WebSocketAddress

  /**
   * A `WebSocket` instance
   */
  private socket: WebSocket

  public constructor(address?: TcpAddressInitializer) {
    super()
    this.address = new WebSocketAddress(address)

    this.socket = new WebSocket(this.address.toString())
    this.socket.addEventListener('message', (event: MessageEvent) => {
      this.receive(event.data)
    })
  }

  protected async send(request: Request): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise(resolve => {
        this.socket.onopen = () => resolve()
      })
    }
    this.socket.send(JSON.stringify(request))
  }
}
