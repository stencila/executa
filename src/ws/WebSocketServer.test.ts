import { WebSocketAddress } from '../base/Transports'
import { WebSocketServer } from './WebSocketServer'

describe('WebSocketServer.address.url', () => {
  test('default', () => {
    expect(new WebSocketServer().address.url()).toBe('ws://127.0.0.1:9000')
  })

  test('string', () => {
    expect(new WebSocketServer('9001').address.url()).toBe(
      'ws://127.0.0.1:9001'
    )
  })

  test('integer', () => {
    expect(new WebSocketServer(9002).address.url()).toBe('ws://127.0.0.1:9002')
  })

  test('object', () => {
    expect(
      new WebSocketServer({
        host: '192.0.0.1',
        port: 9003,
      }).address.url()
    ).toBe('ws://192.0.0.1:9003')
  })

  test('WebSocketAddress', () => {
    expect(new WebSocketServer(new WebSocketAddress(9004)).address.url()).toBe(
      'ws://127.0.0.1:9004'
    )
  })
})
