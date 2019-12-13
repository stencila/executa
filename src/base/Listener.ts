import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import { Executor } from './Executor'
import { Server } from './Server'
import { Addresses } from './Transports'

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
   * Servers that will listen on behalf of
   * this executor and pass on requests to it.
   */
  protected servers: Server[] = []

  public constructor(family = 'li', servers: Server[] = []) {
    super(family)
    this.servers = servers
  }

  /**
   * @implements Implements {@link Executor.addresses}.
   *
   * @description Combines the server addresses for this executor into
   * a single `Addresses` object.
   */
  public addresses(): Promise<Addresses> {
    return Promise.resolve(
      this.servers.reduce(
        async (prev, server) => ({
          ...(await prev),
          ...(await server.addresses())
        }),
        {}
      )
    )
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
  ): Promise<void> {
    for (const server of this.servers)
      server.notify(level, message, node, clients)
    return Promise.resolve()
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

    log.info(`Starting servers`)
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
