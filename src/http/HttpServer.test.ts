import { HttpAddress } from '../base/Transports'
import { HttpServer } from './HttpServer'

describe('HttpServer.address.url', () => {
  test('default', () => {
    expect(new HttpServer().address.url()).toBe('http://127.0.0.1:8000')
  })

  test('string', () => {
    expect(new HttpServer('8001').address.url()).toBe('http://127.0.0.1:8001')
  })

  test('integer', () => {
    expect(new HttpServer(8002).address.url()).toBe('http://127.0.0.1:8002')
  })

  test('object', () => {
    expect(
      new HttpServer({
        host: '192.0.0.1',
        port: 8003,
      }).address.url()
    ).toBe('http://192.0.0.1:8003')
  })

  test('HttpAddress', () => {
    expect(new HttpServer(new HttpAddress(8004)).address.url()).toBe(
      'http://127.0.0.1:8004'
    )
  })
})
