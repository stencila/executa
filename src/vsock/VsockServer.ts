import { getLogger } from '@stencila/logga'
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { Executor } from '../base/Executor'
import { VsockAddress, Addresses, Transport } from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'

const log = getLogger('executa:vsock:server')

export class VsockServer extends StreamServer {
  public readonly address: VsockAddress

  private server?: ChildProcess

  public constructor(address: VsockAddress = new VsockAddress()) {
    super()
    this.address = address
  }

  /**
   * @implements Implements {@link Server.addresses}.
   */
  public addresses(): Promise<Addresses> {
    return Promise.resolve({
      [Transport.vsock]: this.address,
    })
  }

  public async start(executor: Executor): Promise<void> {
    if (this.server === undefined) {
      const server = (this.server = spawn(
        path.join(__dirname, 'vsock-server'),
        [`${this.address.port}`]
      ))
      server.on('error', (err) => log.error(err))
      return super.start(executor, server.stdout, server.stdin)
    }
  }

  public stop(): Promise<void> {
    if (this.server !== undefined) {
      this.server.kill()
    }
    return Promise.resolve()
  }
}
