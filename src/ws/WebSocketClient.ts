import WebSocket from 'isomorphic-ws'

import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { WebSocketAddress } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:ws:client')

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
    const socket = (this.socket = new WebSocket(url, jwt))

    socket.on('error', error => log.error(error))

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
    const json = JSON.stringify(request)
    this.socket.send(json, error => {
      if (error !== undefined) log.error(error)
    })
  }

  public stop(): Promise<void> {
    this.socket.close()
    return Promise.resolve()
  }
}
