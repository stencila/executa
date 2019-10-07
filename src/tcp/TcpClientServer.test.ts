import TcpClient from './TcpClient'
import TcpServer from './TcpServer'

const server = new TcpServer()

beforeAll(async () => {
  server.start()
  await new Promise(resolve => setTimeout(resolve, 1000))
})

afterAll(() => {
  server.stop()
})

describe('TcpClient and TcpServer', () => {
  const client = new TcpClient()

  test('make a simple request', async () => {
    expect(await client.convert('a string')).toEqual('a string')
  })
})
