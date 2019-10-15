import { getLogger } from '@stencila/logga'
// @ts-ignore
import fastifyWebsocket from 'fastify-websocket'
import HttpServer from '../http/HttpServer'
import { WebSocketAddress, TcpAddressInitializer } from '../base/Transports'
import Executor from '../base/Executor'

const log = getLogger('executa:ws:server')

/**
 * A `Server` using WebSockets for communication.
 */
export default class WebSocketServer extends HttpServer {
  public constructor(
    executor?: Executor,
    address: WebSocketAddress = new WebSocketAddress()
  ) {
    super(executor, address)

    this.app.register(fastifyWebsocket, {
      handle: (connection: any) => {
        const { socket } = connection
        // Handle messages from connection
        socket.on('message', async (message: string) => {
          socket.send(await this.receive(message))
        })
        // Register connection
        this.onConnection(connection)
      },
      options: {}
    })
  }

  public get address(): WebSocketAddress {
    return new WebSocketAddress(
      {
        host: this.host,
        port: this.port
      },
      this.defaultJwt
    )
  }
}
