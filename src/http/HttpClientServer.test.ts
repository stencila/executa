import { testClient } from '../test/testClient'
import HttpClient from './HttpClient'
import HttpServer from './HttpServer'

test('HttpClient and HttpServer', async () => {
  const server = new HttpServer()
  await server.start()
  const client = new HttpClient(server.address)
  await testClient(client)
  await server.stop()
})
