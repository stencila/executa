import {PassThrough} from 'stream'
import * as stencila from '@stencila/schema'
import StreamClient from './StreamClient'
import StreamServer from './StreamServer'
import Executor from '../base/Executor';

describe('StreamClient and StreamServer', () => {
  const executor = new Executor()

  const server = new StreamServer(executor)
  const serverIncoming = new PassThrough()
  const serverOutgoing = new PassThrough()
  server.start(serverIncoming, serverOutgoing)

  const client = new StreamClient(serverIncoming, serverOutgoing)

  test('calling capabilities', async () => {
    expect(await client.capabilities()).toEqual(await executor.capabilities())
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
