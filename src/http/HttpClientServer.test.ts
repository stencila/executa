import { testClient } from '../test/testClient'
import { HttpClient } from './HttpClient'
import { HttpServer } from './HttpServer'

beforeAll(() => {
  process.env.JWT_SECRET = 'not-a-secret-at-all'
})

test('HttpClient and HttpServer', async () => {
  const server = new HttpServer()
  await server.start()

  const client = new HttpClient(server.address)
  await testClient(client)
  await client.stop()

  await server.stop()
})
