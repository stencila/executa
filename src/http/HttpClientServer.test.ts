import fetch from 'cross-fetch'

import { testClient } from '../test/testClient'
import { HttpClient } from './HttpClient'
import { HttpServer } from './HttpServer'
import { Worker } from '../base/Worker'

test('HttpClient and HttpServer', async () => {
  const server = new HttpServer(undefined, 'not-a-secret-at-all')
  await server.start(new Worker())

  // Client using JSON RPC protocol
  const clientJ = new HttpClient(server.address)
  await testClient(clientJ)
  await clientJ.stop()

  // Client using "RESTful" protocol
  const clientR = new HttpClient({ ...server.address, protocol: 'restful' })
  await testClient(clientR)
  await clientR.stop()

  // Trailing slashes are ignored
  const response1 = await fetch(server.address.url() + '/manifest')
  const response2 = await fetch(server.address.url() + '/manifest/')
  expect(response2.status).toEqual(response1.status)

  await server.stop()
})
