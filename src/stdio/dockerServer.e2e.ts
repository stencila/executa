import StdioClient from './StdioClient'
import { testClient } from '../test/testClient'

jest.setTimeout(30 * 1000)

test('run a StdioServer inside a Docker container', async () => {
  // Use `interactive` option so that STDIN is kept open.
  // Also means that the container stops when the client is stopped.
  const client = new StdioClient(`docker run --interactive stencila/executa`)
  await testClient(client)
  client.stop()
})
