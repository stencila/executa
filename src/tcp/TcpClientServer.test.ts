import { TcpClient } from './TcpClient'
import { TcpServer } from './TcpServer'
import { testClient } from '../test/testClient'
import { delay } from '../test/delay'

test('TcpClient and TcpServer', async () => {
  const server = new TcpServer()
  await server.start()

  const client1 = new TcpClient(server.address)
  const client2 = new TcpClient(server.address)

  await testClient(client1)
  await testClient(client2)

  server.notify('info', 'A notification from TCP server to clients')
  await delay(100)

  await client1.stop()
  await client2.stop()

  await server.stop()
})
