import WebSocket from 'isomorphic-ws'

import Client from '../base/Client'
import JsonRpcRequest from '../base/JsonRpcRequest'
import { WebSocketAddress, TcpAddressInitializer } from '../base/Transports'

/**
 * A `Client` using the WebSockets API for communication.
 */
export default class WebSocketClient extends Client {
  /**
   * A `WebSocket` instance
   */
  private socket: WebSocket

  public constructor(address: WebSocketAddress = new WebSocketAddress()) {
    super()

    this.socket = new WebSocket(address.toString())
    this.socket.addEventListener('message', event => {
      this.receive(event.data)
    })
  }

  protected async send(request: JsonRpcRequest): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise(resolve => {
        this.socket.onopen = () => resolve()
      })
    }
    this.socket.send(JSON.stringify(request))
  }
}
