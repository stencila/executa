import lolex from 'lolex'
import { Queuer } from './Queuer'
import { Config } from '../config'
import { Worker } from './Worker'
import { CapabilityError } from './errors'
import { Method } from './Executor'

const clock = lolex.install()

test('construct', () => {
  const queuer1 = new Queuer()
  expect(queuer1).toBeInstanceOf(Queuer)

  const queuer2 = new Queuer({
    ...new Config(),
    queueLength: 100,
    queueStale: 10,
    queueInterval: 1,
  })
  expect(queuer2).toBeInstanceOf(Queuer)
})

test('call', async () => {
  const queuer = new Queuer({ ...new Config(), queueLength: 5 })
  const { queue } = queuer

  const p0 = queuer.decode('', 'json')
  const p1 = queuer.encode({}, 'json')
  const p2 = queuer.execute({})
  const p3 = queuer.begin({})
  const p4 = queuer.end({})
  expect(queue.length).toBe(5)

  const p5 = queuer.decode('', 'json')
  await expect(p5).rejects.toThrow(
    new CapabilityError('Queue is at maximum length')
  )

  // Resolve a job
  const j0 = queue[0]
  j0.resolve('r0')
  expect(await p0).toBe('r0')
  expect(queue.length).toBe(4)

  // Reject the next job
  const j1 = queue[0]
  expect(j1.id).not.toBe(j0.id)
  j1.reject(new Error('A test error'))
  await expect(p1).rejects.toThrow(/A test error/)
  expect(queue.length).toBe(3)

  // Both of those jobs should be removed
  const j2 = queue[0]
  expect(j2.id).not.toBe(j1.id)
})

test('cancel', async () => {
  const queuer = new Queuer()

  const job = 'a-job'
  const p1 = queuer.call(Method.decode, { source: '', format: 'json', job })
  expect(await queuer.cancel(job)).toBe(true)
})

test('check', async () => {
  const queuer = new Queuer({ ...new Config(), queueInterval: 1 })
  const worker = new Worker()

  const p0 = queuer.decode('0', 'json')
  const p1 = queuer.decode('1', 'json')

  await queuer.check(worker)

  const p2 = queuer.decode('2', 'json')
  const p3 = queuer.decode('3', 'json')

  clock.tick(1001)

  expect(await p0).toBe(0)
  expect(await p1).toBe(1)
  expect(await p2).toBe(2)
  expect(await p3).toBe(3)
})

test('reduce', async () => {
  const queuer = new Queuer()
  const worker = new Worker()

  const p0 = queuer.decode('0', 'json')
  const p1 = queuer.decode('1', 'json')
  const p2 = queuer.decode('2', 'json')
  const p3 = queuer.decode('3', 'pdf') // Will not be resolved
  const resolved = await queuer.reduce(worker)
  expect(resolved).toBe(3)

  expect(await p0).toBe(0)
  expect(await p1).toBe(1)
  expect(await p2).toBe(2)
})

test('clean', async () => {
  const queuer = new Queuer({ ...new Config(), queueStale: 1 })
  const { queue } = queuer

  const p0 = queuer.decode('', 'json')
  expect(queue.length).toBe(1)

  clock.tick(1001)

  queuer.clean()
  await expect(p0).rejects.toThrow(/Job has become stale/)
  expect(queue.length).toBe(0)

  const p1 = queuer.decode('', 'json')
  expect(queue.length).toBe(1)

  queuer.clean()
  expect(queue.length).toBe(1)
})

test('start + stop', async () => {
  const queuer = new Queuer({
    ...new Config(),
    queueInterval: 1,
    queueStale: 0.5,
  })
  const { queue } = queuer

  await queuer.start()

  const p0 = queuer.decode('', 'json')
  expect(queue.length).toBe(1)

  clock.tick(1001)

  await expect(p0).rejects.toThrow(/Job has become stale/)

  const p1 = queuer.decode('', 'json')
  expect(queue.length).toBe(1)

  await queuer.stop()
  await expect(p1).rejects.toThrow(/Executor is stopping/)
  expect(queue.length).toBe(0)
})
