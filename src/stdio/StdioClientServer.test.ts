import path from 'path'
import * as stencila from '@stencila/schema'
import StdioClient from './StdioClient'

describe('StdioClient and StdioServer', () => {
  const client = new StdioClient('npx ts-node ' + path.join(__dirname, 'stdioTestServer.ts'))

  test('make a simple request', async () => {
    expect(await client.convert('a string')).toEqual('a string')
  })
})
