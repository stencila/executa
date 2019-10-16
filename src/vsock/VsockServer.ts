import { getLogger } from '@stencila/logga'
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { Executor } from '../base/Executor'
import { VsockAddress } from '../base/Transports'
import StreamServer from '../stream/StreamServer'

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
      const server = (this.server = spawn(
        path.join(__dirname, 'vsock-server'),
        [`${this.port}`]
      ))
      server.on('error', log.error)
      return super.start(server.stdout, server.stdin)
    }
  }

  public async stop(): Promise<void> {
    if (this.server !== undefined) {
      this.server.kill()
    }
  }
}
