import * as stencila from '@stencila/schema'
import { DirectClient } from './DirectClient'
import { DirectServer } from './DirectServer'
import { BaseExecutor } from '../base/BaseExecutor'

test('DirectClient and DirectServer', async () => {
  const server = new DirectServer()
  const executor = new BaseExecutor()
  await server.start(executor)
  const client = new DirectClient(server.address)

  expect(await client.manifest()).toEqual(await executor.manifest())

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
