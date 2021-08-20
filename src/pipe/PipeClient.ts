import { getLogger } from '@stencila/logga'
import fs from 'fs'
import glob from 'globby'
import os from 'os'
import path from 'path'
import { StreamClient } from '../stream/StreamClient'
import { PipeAddress, PipeAddressInitializer } from '../base/Transports'
import { InternalError } from '../base/errors'

const log = getLogger('executa:pipe:client')

export class PipeClient extends StreamClient {
  /**
   * The address of the server to connect to.
   */
  public readonly address: PipeAddress

  /**
   * Stream for `<address>.in` to write messages to.
   */
  private outgoing?: fs.WriteStream

  /**
   * Stream for `<address>.out` to read messages from.
   */
  private incoming?: fs.ReadStream

  /**
   * A list of existing client addresses for which
   * a `PipeClient` client has already been started.
   * Used to ensure that there is only one client per address
   * in this process.
   */
  static addresses: PipeAddressInitializer[] = []

  /**
   * Construct a `PipeClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(address: PipeAddressInitializer) {
    super('pi')
    this.address = new PipeAddress(address)
  }

  /**
   * @override Override of {@link StreamClient.start} to obtain a
   * lock on the connection and create file streams for outgoing
   * and incoming pipes.
   */
  public start(): Promise<void> {
    // Check that there are no other clients in this process
    // connected to the pipe
    const address = this.address.url()
    if (PipeClient.addresses.includes(address)) {
      throw new InternalError(
        `There is already a PipeClient for address: ${address}`
      )
    } else {
      PipeClient.addresses.push(address)
    }

    // Create lock file
    const lock = `${this.address}.lock`
    if (fs.existsSync(lock)) {
      try {
        // Check if the process is already running
        const pid = parseInt(fs.readFileSync(lock, 'utf8'))
        process.kill(pid, 0)

        // Lock file exists and owning process is running
        log.warn(
          `Unable to start, another process is already connected to pipe "${lock}": ${pid}`
        )
        return Promise.resolve()
      } catch {
        // Process does not exist or lock file is
        // corrupted. Assume can lock.
      }
    }
    fs.writeFileSync(lock, process.pid, 'utf8')

    // Create streams
    this.outgoing = fs.createWriteStream(`${this.address}.in`)
    this.incoming = fs.createReadStream(`${this.address}.out`)

    // Stop if either stream closes
    const stop = (): void => {
      this.stop().catch((error) => log.error(error))
    }
    this.outgoing.on('close', stop)
    this.incoming.on('close', stop)

    // Log any stream errors
    const error = (error: Error): void => log.error(error)
    this.outgoing.on('error', error)
    this.incoming.on('error', error)

    return super.start(this.outgoing, this.incoming)
  }

  /**
   * @override Override of {@link Executor.stop} to destroy
   * the client's file streams.
   */
  public stop(): Promise<void> {
    // De-register address
    const address = this.address.url()
    const index = PipeClient.addresses.indexOf(address)
    if (index !== -1) PipeClient.addresses.splice(index, 1)

    // Remove lock file
    const lock = `${this.address}.lock`
    if (fs.existsSync(lock)) {
      fs.unlinkSync(lock)
    }

    if (this.outgoing !== undefined) {
      this.outgoing.destroy()
      this.outgoing = undefined
    }
    if (this.incoming !== undefined) {
      this.incoming.destroy()
      this.incoming = undefined
    }

    return super.stop()
  }

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Scans the temporary directory on the machine
   * for pipes and tests whether they are active by requesting
   * a manifest.
   */
  static async discover(): Promise<PipeClient[]> {
    const tmp = fs.realpathSync(os.tmpdir())
    const pattern = path.join(tmp, 'stencila', '*-pipe.in')
    log.debug(`Searching for: ${pattern}`)

    const pipes = await glob(pattern, { onlyFiles: false })
    if (pipes.length === 0) return Promise.resolve([])

    log.debug(`Found pipes: ${pipes.join(', ')}`)
    return pipes.reduce(
      async (prev: Promise<PipeClient[]>, incoming): Promise<PipeClient[]> => {
        const address = incoming.replace(/\.in$/, '')
        const client = new PipeClient(address)
        try {
          await client.manifest()
          return [...(await prev), client]
        } catch (error) {
          log.warn(`Unable to connect to server, ignoring: ${incoming}`)
          return prev
        }
      },
      Promise.resolve([])
    )
  }
}
