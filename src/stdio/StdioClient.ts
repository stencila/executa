import { spawn, ChildProcess } from 'child_process'
import StreamClient from '../stream/StreamClient'
import { StdioAddress } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:stdio:client')
export default class StdioClient extends StreamClient {
  private child: ChildProcess

  public constructor(address: string | Omit<StdioAddress, 'type'>) {
    let command
    let args: string[] = []
    if (typeof address === 'string') {
      const parts = address.split(/\s/)
      command = parts[0]
      args = parts.slice(1)
    } else {
      command = address.command
      if (address.args !== undefined) args = address.args
    }

    const child = spawn(command, args)
    child.on('error', (error: Error) => log.error(error))
    child.on('exit', (code: number | null, signal: string | null) =>
      log.error(
        `Server exited prematurely with exit code ${code} and signal ${signal}`
      )
    )

    const { stdin, stdout } = child
    super(stdin, stdout)

    this.child = child
  }

  /**
   * Stop the child server process
   */
  stop() {
    // Avoid unnecessary log errors by removing listener
    this.child.removeAllListeners('exit')
    this.child.kill()
  }
}
