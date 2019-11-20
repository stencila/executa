import path from 'path'
import { StdioClient } from './StdioClient'
import { testClient } from '../test/testClient'
import { addHandler, LogData } from '@stencila/logga'
import { delay } from '../test/delay'

jest.setTimeout(30 * 1000)

describe('StdioClient and StdioServer', () => {
  const testServer = (arg = ''): string =>
    `npx ts-node --files ${path.join(__dirname, 'stdioTestServer.ts')} ${arg}`

  let clientLogs: LogData[] = []
  addHandler((logData: LogData) => {
    if (
      logData.tag === 'executa:client' ||
      logData.tag === 'executa:stdio:client'
    ) {
      clientLogs = [...clientLogs, logData]
    }
  })

  test('main', async () => {
    const client = new StdioClient(testServer())
    await testClient(client)

    // Do not await the next two calls to `decode` - they do not
    // resolve due to the bad message

    client.decode('send bad message').catch(error => {
      throw error
    })
    await delay(250)
    expect(clientLogs.length).toBe(1)
    expect(clientLogs[0].message).toMatch(
      /^Error parsing message as JSON: ah hah/
    )

    client.decode('crash now!')
    await delay(250)
    expect(clientLogs.length).toBe(2)
    expect(clientLogs[1].message).toMatch(
      /^Server exited prematurely with exit code 1 and signal null/
    )

    await client.stop()
  })

  // These tests require waiting to be sure that the process
  // has had chance to start and crash, so only run on CI
  if (process.env.CI !== undefined) {
    test('crash-on-start', async () => {
      const client = new StdioClient(testServer('crash-on-start'))
      await delay(10000)
      expect(clientLogs.length).toBe(2)
      expect(clientLogs[1].message).toMatch(
        /^Server exited prematurely with exit code 1 and signal null/
      )
      await client.stop()
    })

    test('exit-prematurely', async () => {
      const client = new StdioClient(testServer('exit-prematurely'))
      await delay(10000)
      expect(clientLogs.length).toBe(3)
      expect(clientLogs[2].message).toMatch(
        /^Server exited prematurely with exit code 0 and signal null/
      )
      await client.stop()
    })
  }
})
