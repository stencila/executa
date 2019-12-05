import { Config } from '../config'
import { Method, Call, Executor } from './Executor'
import { uid } from './uid'
import { getLogger } from '@stencila/logga'
import { CapabilityError } from './CapabilityError'

const log = getLogger('executa:queuer')

interface Job<Type> {
  id: string
  call: Call
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
   * Identifier for the interval used to call `clean`
   */
  private cleanInterval?: Interval

  constructor(config: Config = new Config()) {
    super()
    this.config = config
  }

  /**
   * @implements Implements {@link Executor.call} by placing
   * all requests on the queue.
   *
   * @param delegator The executor, if any that delegated this call.
   * Used to notify that executor's clients on the status of the job.
   */
  public async call<Type>(
    method: Method,
    params: Call['params'] = {},
    delegator?: Executor
  ): Promise<Type> {
    const {
      queue,
      config: { queueLength }
    } = this

    if (queue.length >= queueLength)
      throw new CapabilityError('Queue is at maximum length')

    return new Promise<Type>((resolve, reject) => {
      const id = `job-${uid()}`
      const job = {
        id,
        call: { method, params },
        delegator,
        date: new Date(),
        resolve: (result: Type) => {
          this.remove(id)
          resolve(result)
        },
        reject: (error: Error) => {
          this.remove(id)
          reject(error)
        }
      }
      const position = queue.push(job)
      this.notify(
        'info',
        `Job has been added to queue at position ${position}`,
        job
      )
    })
  }

  notify(subject: string, message: string, job: Job<any>) {
    const { call, delegator } = job
    if (delegator !== undefined) {
      const { claims: { clients = []} = {}} = call.params
      delegator.notify(subject, message, undefined, clients)
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
  public async check(executor: Executor): Promise<Interval> {
    await this.reduce(executor)
    return setInterval(() => {
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
    for (const { call, resolve, reject } of [...this.queue]) {
      const { method, params } = call
      let result
      try {
        result = await executor.call(method, params)
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
   * Remove a job from the queue.
   *
   * This method is `protected` because jobs should only
   * be removed by a call to `job.resolve` or `job.reject`.
   */
  protected remove(id: string): void {
    const index = this.queue.findIndex(job => job.id === id)
    this.queue.splice(index, 1)
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
    for (const { reject } of this.queue)
      reject(new Error('Executor is stopping'))
    return Promise.resolve()
  }
}
