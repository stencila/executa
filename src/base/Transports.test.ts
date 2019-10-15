import { TcpAddress } from './Transports'

describe('tcpAddress', () => {
  const defaults = {
    host: '127.0.0.1',
    port: 4321
  }

  test('parses a string with host and port', () => {
    expect(new TcpAddress('example.com:2010', defaults)).toEqual({
      type: 'tcp',
      host: 'example.com',
      port: 2010
    })
  })

  test('parses a number as the port', () => {
    expect(new TcpAddress(2020, defaults)).toEqual({
      type: 'tcp',
      host: '127.0.0.1',
      port: 2020
    })
  })

  test('parses a string with just port', () => {
    expect(new TcpAddress('2030', defaults)).toEqual({
      type: 'tcp',
      host: '127.0.0.1',
      port: 2030
    })
  })
})
