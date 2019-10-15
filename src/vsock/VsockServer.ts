import { getLogger } from '@stencila/logga';
import Executor from '../base/Executor';
import { VsockAddress } from '../base/Transports';
import StreamServer from '../stream/StreamServer';
import { spawn, ChildProcess } from 'child_process';

const log = getLogger('executa:vsock:server')

export default class VsockServer extends StreamServer {

  public readonly port: number

  private server?: ChildProcess

  public constructor(
    executor?: Executor,
    address: VsockAddress = new VsockAddress()
  ) {
    super(executor)

    this.port = address.port
  }

  public get address(): VsockAddress {
    return new VsockAddress(this.port)
  }

  public async start(): Promise<void> {
    if (this.server === undefined) {
      const server = (this.server = spawn(__dirname + '/vsock-server', [`${this.port}`]))
      server.on('error', log.error)
      super.start(server.stdout, server.stdin)
    }
  }

  public async stop(): Promise<void> {
    if (this.server !== undefined) {
      this.server.kill()
    }
  }
}
