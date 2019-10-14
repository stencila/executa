import WebSocketClient from './WebSocketClient'
import WebSocketServer from './WebSocketServer'

const server = new WebSocketServer()
let client: WebSocketClient

beforeAll(async () => {
  await server.start()
  await new Promise(resolve => setTimeout(resolve, 100))
  client = new WebSocketClient(server.address)
})

afterAll(async () => {
  await server.stop()
})

describe('WebSocketClient and WebSocketServer', () => {
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
