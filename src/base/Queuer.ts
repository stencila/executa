import { getLogger } from '@stencila/logga'
import { Config } from '../config'
import { CapabilityError } from './errors'
import { Executor, Method, Params, Manifest } from './Executor'
import * as uid from './uid'

const log = getLogger('executa:queuer')

interface Job<Type> {
  id: string
  method: Method
  params: Params
  delegator?: Executor
  date: Date
  resolve: (result: Type) => void
  reject: (error: Error) => void
}

/**
 * A base `Executor` class that queues all requests.
 */
export class Queuer extends Executor {
  /**
   * A job queue
   */
  public readonly queue: Job<any>[] = []

  /**
   * Configuration options.
   *
   * Currently, using application configuration, but
   * this may be split up later.
   */
  public readonly config: Config

  /**
   * Timer used to call `check`
   */
  private checkInterval?: NodeJS.Timer

  /**
   * Timer used to call `clean`
   */
  private cleanInterval?: NodeJS.Timer

  constructor(config: Config = new Config()) {
    super('qu')
    this.config = config
  }

  /**
   * @override Override of {@link Executor.manifest} to
   * provide additional properties for inspection.
   */
  public async manifest(): Promise<Manifest> {
    const manifest = await super.manifest()
    const queue = this.queue.map(job => {
      const { id, date, method, params } = job
      return { id, date, method, params }
    })
    return {
      ...manifest,
      queue
    }
  }

  /**
   * @override Overrides {@link Executor.call} by placing
   * all requests on the queue.
   *
   * @param client The executor, if any that delegated this call.
   * Used to notify that client on the status of the job.
   */
  public async call<Type>(
    method: Method,
    params: Params = {},
    client?: Executor
  ): Promise<Type> {
    const {
      queue,
      config: { queueLength }
    } = this

    if (queue.length >= queueLength)
      throw new CapabilityError('Queue is at maximum length')

    // If necessary generate a unique id
    const { job: id = uid.generate('jo').toString() } = params

    return new Promise<Type>((resolve, reject) => {
      const job = {
        id,
        method,
        params,
        client,
        date: new Date(),
        resolve: async (result: Type) => {
          await this.cancel(id)
          resolve(result)
        },
        reject: async (error: Error) => {
          await this.cancel(id)
          reject(error)
        }
      }
      const position = queue.push(job)
      this.notifyDelegator(
        job,
        'info',
        `Job has been added to queue at position ${position}`
      )
    })
  }

  /**
   * @override Overrides {@link Executor.cancel} by removing
   * a job from the queue.
   */
  public cancel(job: string): Promise<boolean> {
    const index = this.queue.findIndex(item => item.id === job)
    if (index >= 0) {
      this.queue.splice(index, 1)
      return Promise.resolve(true)
    } else {
      return Promise.resolve(false)
    }
  }

  notifyDelegator(job: Job<any>, subject: string, message: string) {
    const { params, delegator } = job
    if (delegator !== undefined) {
      const { claims: { clients = [] } = {} } = params
      delegator
        .notify(subject, message, undefined, clients)
        .catch(error => log.error(error))
    }
  }

  /**
   * Check the queue on an ongoing basis and attempt to
   * reduce its size by completing jobs.
   *
   * @see {@link Queuer.reduce}
   *
   * @param executor An executor that will attempt
   *                 to complete jobs.
   * @returns A timeout that can be used to cancel the checks
   */
  public async check(executor: Executor): Promise<void> {
    await this.reduce(executor)
    this.checkInterval = setInterval(() => {
      this.reduce(executor).catch(error => log.error(error))
    }, this.config.queueInterval)
  }

  /**
   * Attempt to reduce the size of the queue by completing
   * any jobs that are on it.
   *
   * @param executor An executor that will attempt
   *                 to complete jobs.
   * @returns The amount by which the queue was reduced
   */
  public async reduce(executor: Executor): Promise<number> {
    let resolved = 0
    for (const { method, params, resolve, reject } of [...this.queue]) {
      let result
      try {
        result = await executor.dispatch(method, params)
      } catch (error) {
        if (!(error instanceof CapabilityError)) {
          log.error(error)
          reject(error)
        }
      }
      if (result !== undefined) {
        resolve(result)
        resolved += 1
      }
    }
    return resolved
  }

  /**
   * Clean the queue by removing stale jobs.
   */
  public clean(): void {
    const now = Date.now()
    for (const { date, reject } of [...this.queue]) {
      if ((now - date.valueOf()) / 1000 >= this.config.queueStale) {
        reject(new Error('Job has become stale'))
      }
    }
  }

  /**
   * @override Override of {@link Executor.start} to begin
   * an interval for checking queue.
   */
  public start(): Promise<void> {
    this.cleanInterval = setInterval(
      () => this.clean(),
      this.config.queueInterval * 1000
    )
    return Promise.resolve()
  }

  /**
   * @override Override of {@link Executor.stop} to reject
   * all outstanding jobs in the queue.
   */
  public stop(): Promise<void> {
    if (this.cleanInterval !== undefined) clearInterval(this.cleanInterval)
    if (this.checkInterval !== undefined) clearInterval(this.checkInterval)
    for (const { reject } of this.queue)
      reject(new Error('Executor is stopping'))
    return Promise.resolve()
  }
}
