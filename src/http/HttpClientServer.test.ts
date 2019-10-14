import HttpClient from './HttpClient'
import HttpServer from './HttpServer'

const server = new HttpServer()
let client: HttpClient

beforeAll(async () => {
  await server.start()
  await new Promise(resolve => setTimeout(resolve, 100))
  client = new HttpClient(server.address)
})

afterAll(async () => {
  await server.stop()
})

describe('HttpClient and HttpServer', () => {
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
