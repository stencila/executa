import { VsockServer } from './VsockServer'
import { Worker } from '../base/Worker'

test('VsockServer', async () => {
  const server = new VsockServer()
  await server.start(new Worker())
  await server.stop()
})
