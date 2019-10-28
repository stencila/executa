import { TcpClient } from './TcpClient'
import { TcpServer } from './TcpServer'
import { testClient } from '../test/testClient'

test('TcpClient and TcpServer', async () => {
  const server = new TcpServer()
  await server.start()

  const client = new TcpClient(server.address)
  await testClient(client)
  await client.stop()

  await server.stop()
})
