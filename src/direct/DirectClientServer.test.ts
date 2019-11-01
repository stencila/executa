import * as stencila from '@stencila/schema'
import { DirectClient } from './DirectClient'
import { DirectServer } from './DirectServer'
import { BaseExecutor } from '../base/BaseExecutor'
import { testClient } from '../test/testClient'

test('DirectClient and DirectServer', async () => {
  const server = new DirectServer()
  const executor = new BaseExecutor()
  await server.start(executor)

  const client = new DirectClient(server.address)

  // Run the usual client tests...
  await testClient(client)

  // Run some other tests that take advantage of the fact
  // that we have access to the executor...

  // The results of method calls should be the same on client as on the executor
  const node = stencila.person({
    givenNames: ['Jane'],
    familyNames: ['Jones']
  })
  expect(await client.manifest()).toEqual(await executor.manifest())
  for (const method of ['compile', 'build', 'execute']) {
    // @ts-ignore
    expect(await client[method](node)).toEqual(await executor[method](node))
  }

  // There should be no more requests waiting for a response
  // @ts-ignore that client.requests is private
  expect(Object.keys(client.requests).length).toEqual(0)
})
