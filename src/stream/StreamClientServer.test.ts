import { PassThrough } from 'stream'
import { StreamClient } from './StreamClient'
import { StreamServer } from './StreamServer'
import { Manager } from '../base/Manager'
import { testClient } from '../test/testClient'

test('StreamClient and StreamServer', async () => {
  // @ts-ignore Ignore the fact that this is an abstract class
  const server = new StreamServer()
  const executor = new Manager()
  const serverIncoming = new PassThrough()
  const serverOutgoing = new PassThrough()
  server.start(executor, serverIncoming, serverOutgoing)

  const client = new StreamClient(serverIncoming, serverOutgoing)

  await testClient(client)

  await client.stop()
  server.stop()
})
