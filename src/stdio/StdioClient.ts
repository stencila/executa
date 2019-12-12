import { getLogger } from '@stencila/logga'
import { ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import glob_ from 'glob'
import path from 'path'
import util from 'util'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { StdioAddress, StdioAddressInitializer } from '../base/Transports'
import { StreamClient } from '../stream/StreamClient'
import { Manifest } from '../base/Executor'
import { home } from './util'

const glob = util.promisify(glob_)

const log = getLogger('executa:stdio:client')
export class StdioClient extends StreamClient {
  /**
   * The address of the server to connect to.
   */
  public readonly address: StdioAddress

  /**
   * The child process of the `StdioServer`.
   */
  private child?: ChildProcess

  /**
   * Construct a `StdioClient`.
   *
   * @param address The address of the server to connect to
   * @param manifest The manifest of the server (usually registered to disk)
   */
  public constructor(address: StdioAddressInitializer, manifest?: Manifest) {
    super('io')
    this.address = new StdioAddress(address)
    this.manifestCached = manifest
  }

  /**
   * @override Override of {@link StreamClient.start} to start
   * the child server process and set up event handling.
   */
  public start(): Promise<void> {
    // Don't do anything if the child process is already started
    if (this.child !== undefined) return Promise.resolve()

    const { command, args = [] } = this.address

    log.debug(`Starting StdioServer: ${command} ${args.join(' ')}`)
    const child = (this.child = spawn(command, args))

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

    const { stdin, stdout, stderr } = child

    // Pass and output on stderr to own logs
    // In the future we could try parsing the stderr data as
    // newline-delimited JSON (as emitted by `logga`) using `ndjson`.
    stderr.on('data', (data: Buffer) => {
      log.info(data.toString('utf8'))
    })

    return super.start(stdin, stdout)
  }

  /**
   * @override Overrider of {@link Executor.stop} to
   * stop the child server process.
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

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Scans a know directory on the current machine
   * for manifest files and instantiates a client from there.
   */
  static async discover(): Promise<StdioClient[]> {
    const dir = home()

    // Check the folder exists (it may not e.g. if no executors
    // have been registered)
    try {
      fs.accessSync(dir, fs.constants.R_OK)
    } catch (error) {
      return []
    }

    // Read each manifest file...
    const clients: StdioClient[] = []
    for (const file of await glob(path.join(dir, '*.json'))) {
      let json
      try {
        json = fs.readFileSync(file, { encoding: 'utf8' })
      } catch (error) {
        log.warn(`Error reading file "${file}": ${error.message}`)
        continue
      }

      let manifest: Manifest = { version: 1 }
      try {
        manifest = JSON.parse(json)
      } catch (error) {
        log.warn(`Error parsing file "${file}": ${error.message}`)
      }

      const { addresses = {} } = manifest
      const { stdio } = addresses
      if (stdio !== undefined) {
        const client = new StdioClient(stdio, manifest)
        clients.push(client)
      } else {
        log.warn(`Manifest in "${file}" does not contain a stdio address`)
      }
    }
    return clients
  }
}
