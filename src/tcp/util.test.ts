import { expandAddress, localIP, globalIP } from './util'

describe('expandAddress', () => {
  let localIp = ''
  let globalIp = ''
  beforeAll(async () => {
    localIp = await localIP()
    globalIp = await globalIP()
  })

  test('localhost', async () => {
    expect(await expandAddress('127.0.0.1')).toEqual(['ws://127.0.0.1'])
    expect(await expandAddress('http://127.0.0.1')).toEqual([
      'http://127.0.0.1'
    ])
  })

  test('local', async () => {
    expect(await expandAddress(localIp)).toEqual([
      `ws://${localIp}`,
      'ws://127.0.0.1'
    ])
    expect(await expandAddress(`http://${localIp}`)).toEqual([
      `http://${localIp}`,
      'http://127.0.0.1'
    ])
  })

  test('global', async () => {
    expect(await expandAddress('0.0.0.0')).toEqual([
      `ws://${globalIp}`,
      `ws://${localIp}`,
      'ws://127.0.0.1'
    ])
    expect(await expandAddress('example.org')).toEqual([
      `ws://example.org`,
      `ws://${globalIp}`,
      `ws://${localIp}`,
      'ws://127.0.0.1'
    ])
    expect(await expandAddress('wss://executa.stenci.la/path')).toEqual([
      `wss://executa.stenci.la/path`,
      `wss://${globalIp}/path`,
      `ws://${localIp}:9000/path`,
      'ws://127.0.0.1:9000/path'
    ])
  })
})
