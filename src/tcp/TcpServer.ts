import { getLogger } from '@stencila/logga'
import crypto from 'crypto'
import net from 'net'
import { Executor, Claims } from '../base/Executor'
import {
  TcpAddress,
  TcpAddressInitializer,
  HttpAddress,
  Addresses,
  Transport,
  WebSocketAddress,
} from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'
import { Server } from '../base/Server'
import { Connection } from '../base/Connection'
import * as schema from '@stencila/schema'
import { thisExpression } from '@babel/types'
import { expandAddress } from './util'

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
   * The socket used by this connection.
   */
  socket: net.Socket

  /**
   * The server for this connection.
   *
   * Used to implement {@link TcpConnection.addresses}.
   */
  server: TcpServer

  constructor(socket: net.Socket, server: TcpServer) {
    super()
    this.socket = socket
    this.server = server
  }

  /**
   * @implements Implements {@link Server.addresses}. Necessary
   * because that is an `abstract` method. Just returns addresses
   * of the server that this connection is to.
   */
  public addresses(): Promise<Addresses> {
    return this.server.addresses()
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
  /**
   * The address of this server.
   *
   * Can be a `TcpAddress`, or one of the address types
   * derived from it.
   */
  public readonly address: TcpAddress | HttpAddress | WebSocketAddress

  protected server?: net.Server

  protected connections: { [key: string]: Connection } = {}

  public constructor(address: TcpAddressInitializer = new TcpAddress()) {
    super()
    this.address = new TcpAddress(address)
  }

  /**
   * @implements Implements {@link Server.addresses}.
   */
  public async addresses(): Promise<Addresses> {
    return Promise.resolve({
      [Transport.tcp]: await expandAddress(this.address.url()),
    })
  }

  /**
   * Generate the IP address and port number that this server should
   * use for listening.
   *
   * Translates `this.address`, which is an "advertised" address
   * into a "listening" address. Assumes that this process is not
   * running as a privileged user so overrides any use, implied or
   * otherwise, of a privileged port.
   */
  public listeningAddress(): [string, number] {
    let { scheme, host, port } = this.address
    if (port < 1024) {
      if (scheme.startsWith('http')) port = 8000
      else if (scheme.startsWith('ws')) port = 9000
      log.info(`Overriding to an unpriviledged port for ${scheme}: ${port}`)
    }
    const match = /^\d+\.\d+\.\d+\.\d+$/.test(host)
    if (!match && host !== '127.0.0.1' && host !== 'localhost') {
      host = '0.0.0.0'
      log.info(`Listening on any address available: ${host}`)
    }
    return [host, port]
  }

  protected onConnected(connection: Connection): void {
    log.debug(`Client connected: ${connection.id}`)
    this.connections[connection.id] = connection
  }

  protected onDisconnected(connection: Connection): void {
    log.debug(`Client disconnected: ${connection.id}`)
    delete this.connections[connection.id]
  }

  public async start(executor: Executor): Promise<void> {
    if (this.server === undefined) {
      log.debug(`Starting server: ${this.address.url()}`)

      const server = (this.server = net.createServer())

      server.on('connection', (socket: net.Socket): void => {
        // Register connection and disconnection handler
        const connection = new TcpConnection(socket, this)
        this.onConnected(connection)
        socket.on('close', () => this.onDisconnected(connection))

        // Handle messages from connection
        connection
          .start(executor, socket, socket)
          .catch((error) => log.error(error))
      })

      const { host, port } = this.address
      return new Promise((resolve) =>
        server.listen(port, host, () => resolve())
      )
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
    node?: schema.Node,
    clients?: string[]
  ): void {
    if (clients === undefined) clients = Object.keys(this.connections)
    for (const client of clients) {
      const connection = this.connections[client]
      if (connection !== undefined) connection.notify(level, message, node)
    }
  }

  public async stop(): Promise<void> {
    Object.values(this.connections).forEach((connection) => {
      connection.stop().catch((error) => log.error(error))
    })
    this.connections = {}

    if (this.server !== undefined) {
      log.debug(`Stopping server: ${this.address.url()}`)

      return new Promise((resolve) => {
        if (this.server !== undefined)
          this.server.close(() => {
            if (this.server !== undefined) {
              this.server.unref()
              this.server = undefined
            }
            log.debug(`Stopped server: ${this.address.url()}`)
            resolve()
          })
      })
    }
  }
}
