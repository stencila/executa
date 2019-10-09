import * as stencila from '@stencila/schema'
import DirectClient from './DirectClient'
import DirectServer from './DirectServer'
import Executor from '../base/Executor'

describe('DirectClient and DirectServer', () => {
  const executor = new Executor()
  const server = new DirectServer(executor)
  const client = new DirectClient(server.address())

  test('calling manifest', async () => {
    expect(await client.manifest()).toEqual(await executor.manifest())
  })

  test('calling methods with node', async () => {
    const node = stencila.person({
      givenNames: ['Jane'],
      familyNames: ['Jones']
    })

    for (const method of ['compile', 'build', 'execute']) {
      // @ts-ignore
      expect(await client[method](node)).toEqual(node)
    }

    // There should be no more requests waiting for a response
    // @ts-ignore
    expect(Object.keys(client.requests).length).toEqual(0)
  })

  server.stop()
})
