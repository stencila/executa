import StreamServer from "../stream/StreamServer";
import Executor from "../base/Executor";
import { getLogger } from '@stencila/logga';
import { createServer, Server } from "net";

const log = getLogger('executa:tcp:server')

export default class TcpServer extends StreamServer {

  port: number

  host: string

  server?: Server

  constructor(executor?: Executor, port: number = 7300, host: string = '127.0.0.1') {
    super(executor)
    this.port = port
    this.host = host
  }

  start(): void {
    this.server = createServer(socket => {
      super.start(socket, socket)
    })
    this.server.listen(this.port, this.host)
  }
}
