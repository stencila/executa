import { testClient } from '../test/testClient'
import { HttpClient } from './HttpClient'
import { HttpServer } from './HttpServer'

test('HttpClient and HttpServer', async () => {
  const server = new HttpServer(undefined, 'not-a-secret-at-all')
  await server.start()

  // Client using JSON RPC protocol
  const clientJ = new HttpClient(server.address)
  await testClient(clientJ)
  await clientJ.stop()

  // Client using "RESTful" protocol
  const clientR = new HttpClient({ ...server.address, protocol: 'restful' })
  await testClient(clientR)
  await clientR.stop()

  await server.stop()
})
