import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
import net from 'net'
import { Executor, User } from '../base/Executor'
import { TcpAddress, TcpAddressInitializer } from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'
import { Server } from '../base/Server'
import { Connection } from '../base/Connection'
import { Node } from '@stencila/schema'

const log = getLogger('executa:tcp:server')

/**
 * A TCP connection.
 *
 * Each connection acts as a `StreamServer`, sending and receving
 * length-prexied messages over the TCP stream.
 */
export class TcpConnection extends StreamServer implements Connection {
  /**
   * @implements Implements {@link Connection.id} to provide
   * a unique id for the TCP connection.
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
   * @override Override of {@link StreamServer.address} necessary
   * because that is an `abstract` method. Just returns a default
   * TCP address, not necessarily that of the server!
   */
  public get address(): TcpAddress {
    return new TcpAddress()
  }

  /**
   * @implements Implements {@link Connection.stop} by `end`ing
   * and `unref`ing the socket. According to the docs `destroy()`
   * should be only be used if there are errors.
   */
  public stop(): Promise<void> {
    this.socket.end()
    this.socket.unref()
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
        connection
          .start(executor, socket, socket)
          .catch(error => log.error(error))
      })

      const { host, port } = this.address
      return new Promise(resolve => server.listen(port, host, () => resolve()))
    }
  }

  /**
   * @override Override of {@link Server.notify} that notifies clients
   * via this server's stored `Connection` instances. If the `clients`
   * argument is not supplied then notifies all clients.
   */
  public notify(
    level: string,
    message: string,
    node?: Node,
    clients?: string[]
  ): void {
    if (clients === undefined) clients = Object.keys(this.connections)
    for (const client of clients) {
      const connection = this.connections[client]
      if (connection !== undefined) connection.notify(level, message, node)
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
