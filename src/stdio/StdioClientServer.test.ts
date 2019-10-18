import path from 'path'
import StdioClient from './StdioClient'
import { testClient } from '../test/testClient'

jest.setTimeout(30 * 1000)

describe('StdioClient and StdioServer', () => {
  const testServer = (arg = '') =>
    `npx ts-node ${path.join(__dirname, 'stdioTestServer.ts')} ${arg}`

  test('all-is-ok', async () => {
    const client = new StdioClient(testServer())
    await testClient(client)
    client.stop()
  })
})
