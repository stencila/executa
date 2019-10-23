import WebSocket from 'isomorphic-ws'

import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { WebSocketAddress } from '../base/Transports'

/**
 * A `Client` using the WebSockets API for communication.
 */
export class WebSocketClient extends Client {
  /**
   * A `WebSocket` instance
   */
  private socket: WebSocket

  public constructor(address: WebSocketAddress = new WebSocketAddress()) {
    super()

    const { host = '127.0.1.1', port = '9000', path = '', jwt } = address
    const url = `ws://${host}:${port}${path}`
    this.socket = new WebSocket(url, jwt)
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

  public stop() {
    this.socket.close()
  }
}
