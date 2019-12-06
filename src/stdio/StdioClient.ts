import { getLogger } from '@stencila/logga'
import { ChildProcess, spawn } from 'child_process'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { StdioAddress, StdioAddressInitializer } from '../base/Transports'
import { StreamClient } from '../stream/StreamClient'

const log = getLogger('executa:stdio:client')
export class StdioClient extends StreamClient {
  private child?: ChildProcess

  public constructor(address: StdioAddressInitializer) {
    const { command, args = [] } = new StdioAddress(address)

    const child = spawn(command, args)

    child.on('error', (error: Error) => {
      log.error(
        `Server failed to start: ${command} ${args.join(' ')}: ${error.message}`
      )
      // This event can happen at start up before `super()` is called
      // and `this` is defined. There is not a better way to test for
      // success of startup.
      if (this !== undefined) this.child = undefined
    })

    child.on('exit', (code: number | null, signal: string | null) => {
      log.error(
        `Server exited prematurely with exit code ${code} and signal ${signal}`
      )
      this.child = undefined
    })

    // Use stdin and stout for transport and pipe stderr to
    // stderr of current process
    const { stdin, stdout, stderr } = child
    super(stdin, stdout)

    // TODO: stderr.pipe(process.stderr)

    this.child = child
  }

  /**
   * @override Override of {@link StreamClient.send} to log
   * an error if the client was not able to be started
   */
  protected send(request: JsonRpcRequest): void {
    if (this.child !== undefined) super.send(request)
    else log.error(`Server failed to start or exited prematurely`)
  }

  /**
   * Stop the child server process
   */
  public stop(): Promise<void> {
    // Avoid unnecessary log errors by removing listener
    if (this.child !== undefined) {
      this.child.removeAllListeners('exit')
      this.child.kill()
    }
    return Promise.resolve()
  }

  static discover(): StdioClient[] {
    return []
  }
}
