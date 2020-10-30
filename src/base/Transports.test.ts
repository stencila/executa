import { TcpAddress, HttpAddress, WebSocketAddress } from './Transports'

describe('TcpAddress', () => {
  const defaults = {
    type: 'tcp',
    scheme: 'tcp',
    host: '127.0.0.1',
    port: 7000,
  }

  test('constructor: default', () => {
    expect(new TcpAddress()).toEqual(defaults)
  })

  test('constructor: string as the port', () => {
    expect(new TcpAddress('2010')).toEqual({ ...defaults, port: 2010 })
  })

  test('constructor: number as the port', () => {
    expect(new TcpAddress(2020)).toEqual({ ...defaults, port: 2020 })
  })

  test('constructor: string with just host', () => {
    expect(new TcpAddress('example.com')).toEqual({
      ...defaults,
      host: 'example.com',
    })
  })

  test('constructor: string with host and port', () => {
    expect(new TcpAddress('example.com:2020')).toEqual({
      ...defaults,
      host: 'example.com',
      port: 2020,
    })
  })

  test('constructor: string with scheme, host and port', () => {
    expect(new TcpAddress('tcp://example.com:2020')).toEqual({
      ...defaults,
      host: 'example.com',
      port: 2020,
    })
  })

  test('toString', () => {
    expect(new TcpAddress().url()).toEqual('tcp://127.0.0.1:7000')
  })
})

describe('HttpAddress', () => {
  const defaults = {
    type: 'http',
    scheme: 'http',
    host: '127.0.0.1',
    port: 80,
  }

  test('constructor: defaults', () => {
    expect(new HttpAddress()).toEqual(defaults)
  })

  test('constructor: port only', () => {
    expect(new HttpAddress(8000)).toEqual({ ...defaults, port: 8000 })
    expect(new HttpAddress('8000')).toEqual({ ...defaults, port: 8000 })
  })

  test('constructor: port is scheme default', () => {
    expect(new HttpAddress('https://127.0.0.1')).toEqual({
      ...defaults,
      scheme: 'https',
      port: 443,
    })
  })

  test('constructor: string with scheme and path', () => {
    expect(new HttpAddress('https://server1.example.com/a-path')).toEqual({
      ...defaults,
      scheme: 'https',
      host: 'server1.example.com',
      port: 443,
      path: 'a-path',
    })
  })

  test('constructor: string with scheme, port and path', () => {
    expect(
      new HttpAddress('https://server1.example.com:8000/path/2/a/place')
    ).toEqual({
      ...defaults,
      scheme: 'https',
      host: 'server1.example.com',
      port: 8000,
      path: 'path/2/a/place',
    })
  })

  test('constructor: object with scheme, port and path', () => {
    expect(
      new HttpAddress({
        scheme: 'https',
        port: 8991,
        path: 'custom/path',
      })
    ).toEqual({
      ...defaults,
      scheme: 'https',
      port: 8991,
      path: 'custom/path',
    })
  })

  test('toString', () => {
    expect(new HttpAddress(8080).url()).toEqual('http://127.0.0.1:8080')

    expect(
      new HttpAddress({ host: 'example.org', path: 'some/path' }).url()
    ).toEqual('http://example.org/some/path')

    expect(new HttpAddress('https://example.org').url()).toEqual(
      'https://example.org'
    )

    expect(new HttpAddress('https://example.org:4444').url()).toEqual(
      'https://example.org:4444'
    )
  })
})

describe('WebSocketAddress', () => {
  const defaults = {
    type: 'ws',
    scheme: 'ws',
    host: '127.0.0.1',
    port: 80,
  }

  test('constructor: defaults', () => {
    expect(new WebSocketAddress()).toEqual(defaults)
  })

  test('constructor: string with scheme, port and path', () => {
    expect(
      new WebSocketAddress('wss://server1.example.com:8000/path/2/a/place')
    ).toEqual({
      ...defaults,
      scheme: 'wss',
      host: 'server1.example.com',
      port: 8000,
      path: 'path/2/a/place',
    })
  })

  test('constructor: object with scheme, port and path', () => {
    expect(
      new WebSocketAddress({
        scheme: 'wss',
        port: 8991,
        path: 'custom/path',
      })
    ).toEqual({
      ...defaults,
      scheme: 'wss',
      port: 8991,
      path: 'custom/path',
    })
  })

  test('toString', () => {
    expect(new WebSocketAddress('ws://example.org').url()).toEqual(
      'ws://example.org'
    )

    expect(new WebSocketAddress('wss://example.org:4444').url()).toEqual(
      'wss://example.org:4444'
    )
  })
})
