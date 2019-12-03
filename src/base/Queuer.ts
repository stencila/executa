import { Config } from '../config'
import { Method, Call, Executor } from './Executor'
import { uid } from './uid'
import { Node } from '@stencila/schema'

interface Job<Type> {
  id: string
  call: Call
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
   * Identifier for the interval used to call `check`
   */
  private checkInterval?: any

  constructor(config: Config = new Config()) {
    super()
    this.config = config
  }

  /**
   * @implements Implements {@link Executor.call} by placing
   * all requests on the queue.
   */
  public async call<Type>(
    method: Method,
    params: Call['params'] = {}
  ): Promise<Type> {
    const {
      queue,
      config: { queueLength }
    } = this

    if (queue.length >= queueLength) {
      return Promise.reject(new Error('Queue is at maximum length'))
    }

    return new Promise<Type>((resolve, reject) => {
      const id = `job-${uid()}`
      queue.push({
        id,
        call: { method, params },
        date: new Date(),
        resolve: (result: Type) => {
          this.remove(id)
          resolve(result)
        },
        reject: (error: Error) => {
          this.remove(id)
          reject(error)
        }
      })
    })
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
   * Check the queue for stale jobs.
   */
  public check(): void {
    const {
      queue,
      config: { queueStale }
    } = this

    const now = Date.now()
    for (const { date, reject } of queue) {
      if ((now - date.valueOf()) / 1000 >= queueStale) {
        reject(new Error('Request has become stale'))
      }
    }
  }

  /**
   * @override Override of {@link Executor.start} to begin
   * an interval for checking queue.
   */
  public start(): Promise<void> {
    const { queueInterval } = this.config
    this.checkInterval = setInterval(() => this.check(), queueInterval * 1000)
    return Promise.resolve()
  }

  /**
   * @override Override of {@link Executor.stop} to reject
   * all outstanding jobs in the queue.
   */
  public stop(): Promise<void> {
    if (this.checkInterval !== undefined) clearInterval(this.checkInterval)
    for (const { reject } of this.queue)
      reject(new Error('Executor is stopping'))
    return Promise.resolve()
  }
}
