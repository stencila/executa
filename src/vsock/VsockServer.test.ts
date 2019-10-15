import VsockServer from './VsockServer'

test('VsockServer', async () => {
  const server = new VsockServer()
  await server.start()
  await server.stop()
})
