import { DirectClient } from './DirectClient'
import { DirectServer } from './DirectServer'
import { Manager } from '../base/Manager'
import { testClient } from '../test/testClient'

test('DirectClient and DirectServer', async () => {
  const server = new DirectServer()
  const executor = new Manager()
  await server.start(executor)

  const client = new DirectClient(server.address)

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
  client.notify('info', 'A message from client to server')

  // Notify the client
  server.notify('info', 'A message from server to client')
})
