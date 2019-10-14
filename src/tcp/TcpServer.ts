import StreamServer from '../stream/StreamServer'
import Executor from '../base/Executor'
import { getLogger } from '@stencila/logga'
import { createServer, Server, Socket } from 'net'
import { TcpAddress, TcpAddressInitializer } from '../base/Transports'

const log = getLogger('executa:tcp:server')

export default class TcpServer extends StreamServer {
  public readonly address: TcpAddress

  protected server?: Server

  protected clients: Socket[] = []

  public constructor(executor?: Executor, address?: TcpAddressInitializer) {
    super(executor)
    this.address = new TcpAddress(address)
  }

  protected onConnection(client: Socket) {
    this.clients.push(client)
    client.on('close', () => {
      this.clients.splice(this.clients.indexOf(client), 1)
    })
  }

  public async start(): Promise<void> {
    if (this.server === undefined) {
      log.info(`Starting server: ${this.address.toString()}`)

      const server = (this.server = createServer(async socket => {
        await super.start(socket, socket)
      }))
      server.on('connection', client => this.onConnection(client))

      server.listen(this.address.port, this.address.host)
    }
  }

  public async stop(): Promise<void> {
    if (this.server !== undefined) {
      log.info(`Stopping server ${this.address.toString()}`)

      this.clients.forEach(client => client.destroy())
      this.clients = []

      this.server.close(() => {
        if (this.server !== undefined) this.server.unref()
      })
      this.server = undefined
    }
  }
}
