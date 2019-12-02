import { getLogger } from '@stencila/logga'
import { Executor } from './Executor'
import { Server } from './Server'
import { uid } from './uid'

const log = getLogger('executa:listener')

/**
 * An `Executor` class that listens for requests
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
  protected readonly servers: Server[] = []

  public constructor(servers: Server[] = []) {
    super()
    this.id = uid()
    this.servers = servers
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
    node: Node,
    clients: string[] = []
  ) {
    for (const server of this.servers)
      server.notify(level, message, node, clients)
  }

  /**
   * @implements {Executor.notified}
   *
   * Receive a notification from a client using one of this
   * executor's servers.
   *
   * Just calls the appropriate method of `log`. Override this to
   * provide more fancy notification to users.
   */
  public notified(level: string, message: string): void {
    switch (level) {
      case 'debug':
      case 'info':
      case 'warn':
      case 'error':
        log[level](message)
        break
      default:
        log.info(message)
    }
  }

  /**
   * Start listening by starting all servers.
   */
  public async start(): Promise<void> {
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
