import { getLogger } from '@stencila/logga'
import { ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import glob_ from 'glob'
import path from 'path'
import util from 'util'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { StdioAddress, StdioAddressInitializer } from '../base/Transports'
import { StreamClient } from '../stream/StreamClient'
import { Manifest } from '../base/Executor';
import { home } from './util';

const glob = util.promisify(glob_)

const log = getLogger('executa:stdio:client')
export class StdioClient extends StreamClient {
  private child?: ChildProcess

  public constructor(address: StdioAddressInitializer) {
    const { command, args = [] } = new StdioAddress(address)

    log.debug(`Starting StdioServer: ${command} ${args.join(' ')}`)
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

    // TODO: Parse and emit in own log events.
    // stderr.pipe(process.stderr)

    this.child = child
  }

  /**
   * @override Override of {@link StreamClient.send} to log
   * an error if the child server has failed or exited.
   */
  protected send(request: JsonRpcRequest): void {
    if (this.child !== undefined) super.send(request)
    else log.error(`Server failed to start or exited prematurely`)
  }

  /**
   * Stop the child server process
   */
  public stop(): Promise<void> {
    log.debug(`Stopping StdioServer`)
    if (this.child !== undefined) {
      // Avoid unnecessary log errors by removing listener
      this.child.removeAllListeners('exit')
      this.child.kill()
    }
    return Promise.resolve()
  }

  static async discover(): Promise<StdioClient[]> {
    const dir = home()

    // Check the folder exists (they may not e.g. if no executors have been registered)
    try {
      fs.accessSync(dir, fs.constants.R_OK)
    } catch (error) {
      return []
    }

    const clients: StdioClient[] = []
    for (const file of await glob(path.join(dir, '*.json'))) {
      let json
      try {
        json = fs.readFileSync(file, { encoding: 'utf8' })
      } catch (error) {
        log.warn(`Warning: error reading file "${file}": ${error.message}`)
        continue
      }

      try {
        const manifest = JSON.parse(json) as Manifest
        const client = new StdioClient(manifest.addresses.stdio)
        clients.push(client)
      } catch (error) {
        log.warn(`Warning: error parsing file "${file}": ${error.message}`)
      }
    }

    return clients
  }
}
