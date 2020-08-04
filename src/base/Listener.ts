import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import { Executor, Method, Params } from './Executor'
import { Server } from './Server'
import { Addresses } from './Transports'
import { StdioServer } from '../stdio/StdioServer'

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

  /**
   * Seconds of inactivity after which the listener
   * stops.
   */
  public readonly timeout: number = 0

  /**
   * The UNIX timestamp of the last call to `dispatch`
   * or `notified`.
   */
  private heartbeat = 0

  public constructor(family = 'li', servers: Server[] = [], timeout = 0) {
    super(family)
    this.servers = servers
    this.timeout = timeout
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
          ...(await server.addresses()),
        }),
        {}
      )
    )
  }

  /**
   * @override Override of {@link Executor.dispatch} to
   * update heartbeat with current time.
   */
  public dispatch(method: Method, params: Params = {}): Promise<any> {
    this.heartbeat = Date.now()
    return super.dispatch(method, params)
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
   * @override Override of {@link Executor.notify} to
   * update heartbeat with current time.
   */
  public notified(level: string, message: string, node?: schema.Node): void {
    this.heartbeat = Date.now()
    return super.notified(level, message, node)
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

    log.debug(`Starting servers`)
    await Promise.all(this.servers.map((server) => server.start(this)))
  }

  /**
   * Stop listening by stopping all servers.
   */
  public async stop(): Promise<void> {
    log.debug('Stopping servers')
    await Promise.all(this.servers.map((server) => server.stop()))
  }

  /**
   * Run this executor
   *
   * Starts listening with graceful shutdown on `SIGINT` or `SIGTERM`,
   * and checking for timeout (if set).
   *
   * @see {@link Server.run}
   */
  public run(): Promise<void> {
    const stop = (): void => {
      this.stop()
        .then(() => process.exit())
        .catch((error) =>
          log.error(`Error when stopping executor: ${error.message}`)
        )
    }

    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    this.heartbeat = Date.now()
    if (this.timeout > 0) {
      const interval = setInterval((): void => {
        const duration = (Date.now() - this.heartbeat) / 1000
        console.log(duration, this.heartbeat, this.timeout)
        if (duration > this.timeout) {
          clearInterval(interval)
          log.info(`Timed out after ${Math.round(duration)}s`)
          stop()
        }
      }, 1000)
    }

    return this.start()
  }

  /**
   * Register this listener so that it can
   * be discovered by other executors.
   *
   * @returns The path to the registration file.
   */
  public async register(): Promise<string> {
    const name = this.constructor.name.toLowerCase()
    return StdioServer.register(name, await this.manifest())
  }
}
