import { TcpAddress, HttpAddress } from './Transports'

describe('TcpAddress', () => {
  const defaults = {
    host: '127.0.0.1',
    port: 4321
  }

  test('constructor: string with host and port', () => {
    expect(new TcpAddress('example.com:2010', defaults)).toEqual({
      type: 'tcp',
      host: 'example.com',
      port: 2010
    })
  })

  test('constructor: number as the port', () => {
    expect(new TcpAddress(2020, defaults)).toEqual({
      type: 'tcp',
      host: '127.0.0.1',
      port: 2020
    })
  })

  test('constructor: string with just port', () => {
    expect(new TcpAddress('2030', defaults)).toEqual({
      type: 'tcp',
      host: '127.0.0.1',
      port: 2030
    })
  })

  test('toString', () => {
    expect(new TcpAddress().toString()).toEqual('tcp://127.0.0.1:7000')
  })
})

describe('HttpAddress', () => {
  test('constructor: string with host and port', () => {
    expect(new HttpAddress()).toEqual({
      type: 'http',
      host: '127.0.0.1',
      port: 8000,
      path: '',
      jwt: undefined
    })
  })

  test('toString', () => {
    expect(new HttpAddress().toString()).toEqual('http://127.0.0.1:8000')

    expect(new HttpAddress(undefined, '/some/path').toString()).toEqual(
      'http://127.0.0.1:8000/some/path'
    )
  })
})
