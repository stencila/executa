import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
import net from 'net'
import { Executor, User } from '../base/Executor'
import { TcpAddress, TcpAddressInitializer } from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'
import { Server } from '../base/Server'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { JsonRpcRequest } from '../base/JsonRpcRequest'

const log = getLogger('executa:tcp:server')

/**
 * A TCP connection.
 *
 * Each connection acts as a `StreamServer`, sending and receving
 * length-prexied messages over the TCP stream.
 */
export class TcpConnection extends StreamServer implements Connection {
  /**
   * @inheritdoc
   */
  id: string = crypto.randomBytes(32).toString('hex')

  /**
   * The socket used by this connection
   */
  socket: net.Socket

  constructor(socket: net.Socket) {
    super()
    this.socket = socket
  }

  /**
   * @inheritdoc
   *
   * It is necessary to override this method, so just return a
   * default address.
   */
  public get address(): TcpAddress {
    return new TcpAddress()
  }

  public start(executor?: Executor): Promise<void> {
    return super.start(executor, this.socket, this.socket)
  }

  /**
   * Send a notification to the client.
   *
   * This method has the same signature as `Executor.notify`
   * and a similar implementation to `Client.notify`.
   */
  public notify(subject: string, message: string): void {
    const notification = new JsonRpcRequest(subject, { message }, false)
    this.send(notification)
  }

  public stop(): Promise<void> {
    this.socket.destroy()
    return Promise.resolve()
  }
}

export class TcpServer extends Server {
  protected readonly host: string

  protected readonly port: number

  protected server?: net.Server

  protected connections: { [key: string]: Connection } = {}

  public constructor(address: TcpAddressInitializer = new TcpAddress()) {
    super()

    const tcpAddress = new TcpAddress(address)
    this.host = tcpAddress.host
    this.port = tcpAddress.port
  }

  public get address(): TcpAddress {
    return new TcpAddress({
      host: this.host,
      port: this.port
    })
  }

  protected onConnected(connection: Connection): void {
    this.connections[connection.id] = connection
  }

  protected onDisconnected(connection: Connection): void {
    delete this.connections[connection.id]
  }

  public async start(executor?: Executor): Promise<void> {
    if (this.server === undefined) {
      log.info(`Starting server: ${this.address.url()}`)

      const server = (this.server = net.createServer())

      server.on('connection', (socket: net.Socket): void => {
        // Register connection and disconnection handler
        const connection = new TcpConnection(socket)
        this.onConnected(connection)
        socket.on('close', () => this.onDisconnected(connection))

        // Handle messages from connection
        connection.start(executor).catch(error => log.error(error))
      })

      const { host, port } = this.address
      return new Promise(resolve => server.listen(port, host, () => resolve()))
    }
  }

  public async stop(): Promise<void> {
    if (this.server !== undefined) {
      const url = this.address.url()
      log.info(`Stopping server ${url}`)

      Object.values(this.connections).forEach(connection => {
        connection.stop().catch(error => log.error(error))
      })
      this.connections = {}

      return new Promise(resolve => {
        if (this.server !== undefined)
          this.server.close(() => {
            if (this.server !== undefined) {
              this.server.unref()
              this.server = undefined
            }
            log.info(`Stopped server ${url}`)
            resolve()
          })
      })
    }
  }
}
