import TcpClient from './TcpClient'
import TcpServer from './TcpServer'
import { TcpAddress } from '../base/Transports'

const server = new TcpServer()
let client: TcpClient

beforeAll(async () => {
  server.start()
  await new Promise(resolve => setTimeout(resolve, 1000))
  client = new TcpClient(server.address() as TcpAddress)
})

afterAll(() => {
  server.stop()
})

describe('TcpClient and TcpServer', () => {
  test('decode', async () => {
    expect(await client.decode('3.14')).toEqual(3.14)
    expect(await client.decode('{"type":"Entity"}', 'json')).toEqual({
      type: 'Entity'
    })
  })

  test('encode', async () => {
    expect(await client.encode(3.14)).toEqual('3.14')
    expect(await client.encode({ type: 'Entity' }, 'json')).toEqual(
      '{"type":"Entity"}'
    )
  })

  test('execute', async () => {
    expect(await client.execute({ type: 'Entity' })).toEqual({ type: 'Entity' })
  })
})
