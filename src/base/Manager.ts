import { getLogger } from '@stencila/logga'
import { CapabilityError } from './errors'
import { Delegator } from './Delegator'
import { Method, Claims, Manifest } from './Executor'
import { Listener } from './Listener'
import { Queuer } from './Queuer'
import { Server } from './Server'
import { Worker } from './Worker'
import * as schema from '@stencila/schema'

const log = getLogger('executa:manager')

/**
 * An `Executor` class implementation which combines
 * a `Delegator` and a `Queuer`.
 */
export class Manager extends Listener {
  delegator: Delegator
  queuer: Queuer

  constructor(
    servers: Server[] = [],
    delegator: Delegator = new Delegator([new Worker()]),
    queuer: Queuer = new Queuer()
  ) {
    super('ma', servers)
    this.delegator = delegator
    this.queuer = queuer
  }

  /**
   * @override Override of {@link Listener.manifest} to
   * provide additional properties for inspection.
   */
  public async manifest(): Promise<Manifest> {
    const manifest = await super.manifest()
    const delegator = await this.delegator.manifest()
    const queuer = await this.queuer.manifest()
    return {
      ...manifest,
      delegator,
      queuer
    }
  }

  /**
   * @override Override of {@link Executor.call} that
   * places a call on the queue if it is unable to
   * be delegated.
   */
  public async call(
    method: Method,
    params: { [key: string]: any }
  ): Promise<any> {
    // TODO: Call endHere

    try {
      const result = await this.delegator.call(method, params)
      return result
    } catch (error) {
      if (error instanceof CapabilityError) {
        try {
          switch (method) {
            case Method.begin:
              return this.beginHere(params.node)
          }
        } catch (error) {
          if (error instanceof CapabilityError) {
            return this.queuer.call(method, params, this)
          }
          throw error
        }
      }
      throw error
    }
  }

  /**
   * Implements {@link Executor.begin} to
   * begin a `SoftwareSession` in the current
   * environment.
   *
   * This method should only be called if
   * unable to delegate to a peer.
   */
  public beginHere(node: schema.Node): Promise<schema.SoftwareSession> {
    if (schema.isA('SoftwareSession', node)) {
      // TODO: Assign id and dateStart etc to session
      return Promise.resolve(node)
    }
    throw new CapabilityError(
      `Unable to compile node of type "${schema.nodeType(node)}"`
    )
  }

  /**
   * End a `SoftwareSession` that was begun by
   * this manager.
   *
   * This method should not be used for
   * sessions that were begun elsewhere.
   *
   * @see {@link Executor.end}
   */
  public endHere(
    session: schema.SoftwareSession
  ): Promise<schema.SoftwareSession> {
    // TODO
    return Promise.resolve(session)
  }

  /**
   * @override Override of {@link Listener.start} which
   * also starts periodic checking of the queue
   */
  async start(servers: Server[] = []): Promise<void> {
    await super.start(servers)
    await this.queuer.check(this.delegator)
  }
}
