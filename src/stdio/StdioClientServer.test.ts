import path from 'path'
import StdioClient from './StdioClient'

describe('StdioClient and StdioServer', () => {
  const client = new StdioClient(
    'npx ts-node ' + path.join(__dirname, 'stdioTestServer.ts')
  )

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
