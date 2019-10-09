import StreamServer from '../stream/StreamServer'
import Executor from '../base/Executor'
import { getLogger } from '@stencila/logga'
import { createServer, Server } from 'net'
import { TcpAddress, Transport } from '../base/Transports'

const log = getLogger('executa:tcp:server')

export default class TcpServer extends StreamServer {
  private port: number

  private host: string

  private server?: Server

  public constructor(
    executor?: Executor,
    port: number = 7300,
    host: string = '127.0.0.1'
  ) {
    super(executor)
    this.port = port
    this.host = host
  }

  public address(): TcpAddress {
    return {
      type: Transport.tcp,
      host: this.host,
      port: this.port
    }
  }

  public start(): void {
    this.server = createServer(socket => {
      super.start(socket, socket)
    })
    this.server.listen(this.port, this.host)
  }
}
