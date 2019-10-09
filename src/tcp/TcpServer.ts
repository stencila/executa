import StreamServer from '../stream/StreamServer'
import Executor from '../base/Executor'
import { getLogger } from '@stencila/logga'
import { createServer, Server, Socket } from 'net'
import { TcpAddress, tcpAddress, Transport } from '../base/Transports'

const log = getLogger('executa:tcp:server')

export default class TcpServer extends StreamServer {
  private port: number

  private host: string

  private server?: Server

  private clients: Socket[] = []

  public constructor(
    executor?: Executor,
    address?: string | Omit<TcpAddress, 'type'>
  ) {
    super(executor)

    const { host, port } = tcpAddress(address, {
      host: '127.0.0.1',
      port: 2000
    })
    this.host = host
    this.port = port
  }

  public address(): TcpAddress {
    return {
      type: Transport.tcp,
      host: this.host,
      port: this.port
    }
  }

  public start(): void {
    if (this.server === undefined) {
      log.info(`Starting server tcp://${this.host}:${this.port}`)

      const server = (this.server = createServer(socket => {
        super.start(socket, socket)
      }))
      server.on('connection', client => {
       log.info(`Client connected`)
        this.clients.push(client)
        client.on('close', () => {
          log.info(`Client disconnected`)
          this.clients.splice(this.clients.indexOf(client), 1)
        })
      })

      server.listen(this.port, this.host)
    }
  }

  public stop(): void {
    if (this.server !== undefined) {
      log.info(`Stopping server tcp://${this.host}:${this.port}`)

      this.clients.forEach(client => client.destroy())
      this.server.close(() => {
        if (this.server !== undefined) this.server.unref()
      })

      this.server = undefined
    }
  }
}
