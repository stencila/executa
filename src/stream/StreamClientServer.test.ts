import { PassThrough } from 'stream'
import * as stencila from '@stencila/schema'
import { StreamClient } from './StreamClient'
import { StreamServer } from './StreamServer'
import { Manager } from '../base/Manager'

describe('StreamClient and StreamServer', () => {
  // @ts-ignore Ignore the fact that this is an abstract class
  const server = new StreamServer()
  const executor = new Manager()
  const serverIncoming = new PassThrough()
  const serverOutgoing = new PassThrough()
  server.start(executor, serverIncoming, serverOutgoing)

  const client = new StreamClient(serverIncoming, serverOutgoing)

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
