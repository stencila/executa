import { tcpAddress } from './Transports'

describe('tcpAddress', () => {
  const defaults = {
    host: '127.0.0.1',
    port: 4321
  }

  test('parses a string with host and port', () => {
    expect(tcpAddress('example.com:2010', defaults)).toEqual({
      host: 'example.com',
      port: 2010
    })
  })

  test('parses a number as the port', () => {
    expect(tcpAddress(2020, defaults)).toEqual({
      host: '127.0.0.1',
      port: 2020
    })
  })

  test('parses a string with just port', () => {
    expect(tcpAddress('2030', defaults)).toEqual({
      host: '127.0.0.1',
      port: 2030
    })
  })
})
