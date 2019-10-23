import { getLogger } from '@stencila/logga'
import { createServer, Server, Socket } from 'net'
import { Executor } from '../base/Executor'
import { TcpAddress } from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'

const log = getLogger('executa:tcp:server')

export class TcpServer extends StreamServer {
  protected readonly host: string

  protected readonly port: number

  protected server?: Server

  protected clients: Socket[] = []

  public constructor(address: TcpAddress = new TcpAddress()) {
    super()

    const { host, port } = address
    this.host = host
    this.port = port
  }

  public get address(): TcpAddress {
    return new TcpAddress({
      host: this.host,
      port: this.port
    })
  }

  protected onConnected(client: Socket): void {
    this.clients.push(client)
  }

  protected onDisconnected(client: Socket): void {
    this.clients.splice(this.clients.indexOf(client), 1)
  }

  public async start(executor?: Executor): Promise<void> {
    if (this.server === undefined) {
      log.info(`Starting server: ${this.address.toString()}`)

      const server = (this.server = createServer(socket => {
        super.start(executor, socket, socket).catch(e => {
          log.error(
            `Failed to start server: ${this.address.toString()}\n\n${e}`
          )
        })
      }))
      server.on('connection', client => {
        this.onConnected(client)
        client.on('close', () => this.onDisconnected(client))
      })

      const { host, port } = this.address
      return new Promise(resolve => server.listen(port, host, () => resolve()))
    }
  }

  public async stop(): Promise<void> {
    if (this.server !== undefined) {
      const url = this.address.toString()
      log.info(`Stopping server ${url}`)

      this.clients.forEach(client => client.destroy())
      this.clients = []

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
