import { testClient } from '../test/testClient'
import WebSocketClient from './WebSocketClient'
import WebSocketServer from './WebSocketServer'
import { WebSocketAddress } from '../base/Transports'

beforeAll(() => {
  process.env.JWT_SECRET = 'not-a-secret-at-all'
})

test('WebSocketClient and WebSocketServer', async () => {
  // Start on a different port to base HttpServer to avoid clash
  // when tests are run in parallel
  const server = new WebSocketServer(undefined, new WebSocketAddress(8001))
  await server.start()
  const client = new WebSocketClient(server.address)
  await testClient(client)
  await server.stop()
})
