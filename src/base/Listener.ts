import { getLogger } from '@stencila/logga'
import { Executor, Addresses } from './Executor'
import { Server } from './Server'
import { uid } from './uid'
import schema from '@stencila/schema'

const log = getLogger('executa:listener')

/**
 * A base `Executor` class that listens for requests
 * and notifications using one or more `Server`s.
 *
 * Is also able to `notify()` clients that are
 * connected to those servers.
 */
export abstract class Listener extends Executor {
  /**
   * The unique id of this executor.
   *
   * Used by peers to avoid duplicate entries for an
   * executor (e.g. due to having multiple servers
   * and therefore multiple addresses)
   */
  public readonly id: string

  /**
   * Servers that will listen on behalf of
   * this executor and pass on requests to it.
   */
  protected servers: Server[] = []

  public constructor(servers: Server[] = []) {
    super()
    this.id = uid()
    this.servers = servers
  }

  /**
   * Get a map of server addresses for this executor.
   */
  public addresses(): Addresses {
    return this.servers
      .map(server => server.address)
      .reduce((prev, curr) => ({ ...prev, ...{ [curr.type]: curr } }), {})
  }

  /**
   * @implements {Executor.notify}
   *
   * Send a notification to clients via each of this
   * executor's servers
   */
  public notify(
    level: string,
    message: string,
    node?: schema.Node,
    clients: string[] = []
  ) {
    for (const server of this.servers)
      server.notify(level, message, node, clients)
  }

  /**
   * Start listening by starting all servers.
   *
   * @param servers Any additional servers to start.
   */
  public async start(servers: Server[] = []): Promise<void> {
    this.servers = [...this.servers, ...servers]

    if (this.servers.length === 0) {
      log.warn('No servers configured; executor will not be accessible.')
      return
    }

    log.info(
      `Starting servers: ${this.servers
        .map(server => server.address.type)
        .join(', ')}`
    )
    await Promise.all(this.servers.map(server => server.start(this)))
  }

  /**
   * Stop listening by stopping all servers.
   */
  public async stop(): Promise<void> {
    log.info('Stopping servers')
    await Promise.all(this.servers.map(server => server.stop()))
  }

  /**
   * Run this executor
   *
   * Starts listening with graceful shutdown on `SIGINT` or `SIGTERM`.
   *
   * @see {@link Server.run}
   */
  public run(): Promise<void> {
    const stop = (): void => {
      this.stop()
        .then(() => process.exit())
        .catch(error =>
          log.error(`Error when stopping executor: ${error.message}`)
        )
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    return this.start()
  }
}
