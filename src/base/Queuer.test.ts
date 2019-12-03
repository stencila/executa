import { Queuer } from './Queuer'
import { Config } from '../config'
import { delay } from '../test/delay'

test('construct', () => {
  const queuer1 = new Queuer()
  expect(queuer1).toBeInstanceOf(Queuer)

  const queuer2 = new Queuer({
    ...new Config(),
    queueLength: 100,
    queueStale: 10,
    queueInterval: 1
  })
  expect(queuer2).toBeInstanceOf(Queuer)
})

test('call', async () => {
  const queuer = new Queuer({ ...new Config(), queueLength: 5 })
  const { queue } = queuer

  const p0 = queuer.decode('')
  const p1 = queuer.encode({})
  const p2 = queuer.execute({})
  const p3 = queuer.begin({})
  const p4 = queuer.end({})
  expect(queue.length).toBe(5)

  const p5 = queuer.manifest()
  await expect(p5).rejects.toThrow(/Queue is at maximum length/)

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

test('check', async () => {
  const queuer = new Queuer({ ...new Config(), queueStale: 0.001 })
  const { queue } = queuer

  const p0 = queuer.decode('')
  expect(queue.length).toBe(1)

  await delay(20)

  queuer.check()
  await expect(p0).rejects.toThrow(/Request has become stale/)
  expect(queue.length).toBe(0)

  const p1 = queuer.decode('')
  expect(queue.length).toBe(1)

  queuer.check()
  expect(queue.length).toBe(1)
})

test('start + stop', async () => {
  const queuer = new Queuer({
    ...new Config(),
    queueStale: 0.001,
    queueInterval: 0.0001
  })
  const { queue } = queuer

  await queuer.start()

  const p0 = queuer.decode('')
  expect(queue.length).toBe(1)

  await expect(p0).rejects.toThrow(/Request has become stale/)

  const p1 = queuer.decode('')
  expect(queue.length).toBe(1)

  await queuer.stop()
  await expect(p1).rejects.toThrow(/Executor is stopping/)
  expect(queue.length).toBe(0)
})
