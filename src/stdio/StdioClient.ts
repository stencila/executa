import { spawn, ChildProcess } from 'child_process'
import { StreamClient } from '../stream/StreamClient'
import { StdioAddressInitializer, StdioAddress } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:stdio:client')
export class StdioClient extends StreamClient {
  private child: ChildProcess

  public constructor(address: StdioAddressInitializer) {
    const { command, args } = new StdioAddress(address)

    const child = spawn(command, args)
    child.on('error', (error: Error) => log.error(error))
    child.on('exit', (code: number | null, signal: string | null) =>
      log.error(
        `Server exited prematurely with exit code ${code} and signal ${signal}`
      )
    )

    // Use stdin and stout for transport and pipe stderr to
    // stderr of current process
    const { stdin, stdout, stderr } = child
    super(stdin, stdout)
    // TODO: stderr.pipe(process.stderr)

    this.child = child
  }

  /**
   * Stop the child server process
   */
  public stop(): Promise<void> {
    // Avoid unnecessary log errors by removing listener
    this.child.removeAllListeners('exit')
    this.child.kill()
    return Promise.resolve()
  }

  static discover(): StdioClient[] {
    return []
  }
}
