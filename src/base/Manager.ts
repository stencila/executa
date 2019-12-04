import { getLogger } from '@stencila/logga'
import { Method } from './Executor'
import { Listener } from './Listener'
import { Worker } from './Worker'
import { Queuer } from './Queuer'
import { Delegator } from './Delegator'
import { CapabilityError } from './CapabilityError'

const log = getLogger('executa:manager')

/**
 * An `Executor` class implementation which combines
 * a `Delegator` and a `Queuer`.
 */
export class Manager extends Listener {
  delegator: Delegator
  queuer: Queuer

  constructor(
    delegator: Delegator = new Delegator([new Worker()]),
    queuer: Queuer = new Queuer()
  ) {
    super()
    this.delegator = delegator
    this.queuer = queuer
  }

  /**
   * @override Override of {@link Executor.call} which
   * places the call on the queue if it is unable to
   * be delegated.
   */
  public call(method: Method, params: { [key: string]: any }): Promise<any> {
    try {
      return this.delegator.call(method, params)
    } catch (error) {
      if (error instanceof CapabilityError) {
        return this.queuer.call(method, params)
      }
      throw error
    }
  }

  /**
   * @override Override of {@link Listener.start} which
   * also starts periodic checking of the queue
   */
  async start(): Promise<void> {
    await super.start()
    this.queuer.check(this.delegator)
  }
}
