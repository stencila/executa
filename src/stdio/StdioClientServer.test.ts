import path from 'path'
import { StdioClient } from './StdioClient'
import { testClient } from '../test/testClient'
import { nextLogData } from '../test/nextLogData'

// Some of these tests take time to run
// due to spawning a ts-node process, so
// increase timeout to avoid this:
// https://travis-ci.org/stencila/executa/jobs/614741283#L381
jest.setTimeout(30 * 1000)

describe('StdioClient and StdioServer', () => {
  const testServer = (arg = ''): string =>
    `npx ts-node --files ${path.join(__dirname, 'stdioTestServer.ts')} ${arg}`

  const nextMessage = async () =>
    (await nextLogData(['executa:client', 'executa:stdio:client'])).message

  test('main', async () => {
    const client = new StdioClient(testServer())
    await testClient(client)

    // Do not await the next two calls to `decode` - they do not
    // resolve due to the bad message

    client.decode('send bad message').catch(error => {
      throw error
    })
    expect(await nextMessage()).toMatch(
      /^Error parsing message as JSON: ah hah/
    )

    client.decode('crash now!').catch(error => {
      throw error
    })
    expect(await nextMessage()).toMatch(
      /^Server exited prematurely with exit code 1 and signal null/
    )

    await client.stop()
  })

  // These tests add ~5s to test run time (involve starting more ts-node processes)
  // and are somewhat redundant given last 'crash now' test above.
  // So to keep test run times low during development they are only run on CI.
  if (process.env.CI !== undefined) {
    test('crash-on-start', async () => {
      const client = new StdioClient(testServer('crash-on-start'))
      expect(await nextMessage()).toMatch(
        /^Server exited prematurely with exit code 1 and signal null/
      )
      await client.stop()
    })

    test('exit-prematurely', async () => {
      const client = new StdioClient(testServer('exit-prematurely'))
      expect(await nextMessage()).toMatch(
        /^Server exited prematurely with exit code 0 and signal null/
      )
      await client.stop()
    })
  }
})
