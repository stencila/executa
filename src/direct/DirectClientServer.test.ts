import { DirectClient } from './DirectClient'
import { DirectServer } from './DirectServer'
import { testClient } from '../test/testClient'
import { Worker } from '../base/Worker'

test('DirectClient and DirectServer', async () => {
  const server = new DirectServer()
  const executor = new Worker()
  await server.start(executor)

  const client = new DirectClient({ server })

  // Run the usual client tests...
  await testClient(client)

  // Run some other tests that take advantage of the fact
  // that we have access to the executor...

  // Method calls give same result as calling directly
  expect(await client.manifest()).toEqual(await executor.manifest())
  expect(await client.decode('{"a": 1}', 'json')).toEqual(
    await executor.decode('{"a": 1}', 'json')
  )

  // There should be no more requests waiting for a response
  // @ts-ignore that client.requests is private
  expect(Object.keys(client.requests).length).toEqual(0)

  // Notify the server
  await client.notify('info', 'A message from client to server')

  // Notify the client
  await server.notify('info', 'A message from server to client')
})
