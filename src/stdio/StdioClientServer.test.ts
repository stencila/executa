import fs from 'fs'
import path from 'path'
import { Worker } from '../base/Worker'
import { nextLogData } from '../test/nextLogData'
import { testClient } from '../test/testClient'
import { StdioClient } from './StdioClient'
import { StdioServer } from './StdioServer'
import { home } from './util'
import { Listener } from '../base/Listener'

// Some of these tests take time to run
// due to spawning a ts-node process, so
// increase timeout to avoid this:
// https://travis-ci.org/stencila/executa/jobs/614741283#L381
jest.setTimeout(30 * 1000)

describe('StdioClient and StdioServer', () => {
  const testServer = (arg = ''): string =>
    `npx ts-node --files ${path.join(__dirname, 'stdioTestServer.ts')} ${arg}`

  const nextClientMessage = async () =>
    (await nextLogData(['executa:client', 'executa:stdio:client']))[0].message

  const nextServerMessages = async (count = 1) =>
    (await nextLogData(['executa:stdio:server'], count)).map(
      data => data.message
    )

  test('main', async () => {
    const client = new StdioClient(testServer())

    await testClient(client)

    // Do not await the next two calls to `decode` - they do not
    // resolve due to the bad message

    const message = nextClientMessage()
    client.decode('send bad message').catch(error => {
      throw error
    })
    expect(await message).toMatch(/^Error parsing message as JSON: ah hah/)

    await client.stop()
  })

  test('crash', async () => {
    const client = new StdioClient(testServer())

    await client.start()
    const message = nextClientMessage()
    client.decode('crash now!').catch(error => {
      throw error
    })
    expect(await message).toMatch(
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
      expect(await nextClientMessage()).toMatch(
        /^Server exited prematurely with exit code 1 and signal null/
      )
      await client.stop()
    })

    test('exit-prematurely', async () => {
      const client = new StdioClient(testServer('exit-prematurely'))
      expect(await nextClientMessage()).toMatch(
        /^Server exited prematurely with exit code 0 and signal null/
      )
      await client.stop()
    })
  }

  test('register', async () => {
    const manifestFile = path.join(home(), 'stdio-test.json')
    const removeManifestFile = () => {
      if (fs.existsSync(manifestFile)) fs.unlinkSync(manifestFile)
    }

    removeManifestFile()

    StdioServer.register('stdio-test', {
      version: 1,
      addresses: {
        stdio: 'dummy address'
      }
    })
    expect(fs.existsSync(manifestFile)).toBe(true)

    removeManifestFile()

    const nextMessages = nextServerMessages(2)
    StdioServer.register('stdio-test', { version: 1 })
    const messages = await nextMessages
    expect(messages[0]).toMatch(/^Registering executor "stdio-test" in folder/)
    expect(messages[1]).toMatch(/^Manifest does not include a STDIO address/)
    expect(fs.existsSync(manifestFile)).toBe(true)

    removeManifestFile()
  })
})
