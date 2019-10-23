import { Client } from '../base/Client'

/**
 * Test that the methods of a client (that is connected to a server)
 * work as expected. This function is designed to be used to test
 * all classes that extend `Client`.
 *
 * @param client An instance of a `Client`
 */
export const testClient = async (client: Client) => {
  expect(await client.decode('3.14')).toEqual(3.14)
  expect(await client.decode('{"type":"Entity"}', 'json')).toEqual({
    type: 'Entity'
  })

  expect(await client.encode(3.14)).toEqual('3.14')
  expect(await client.encode({ type: 'Entity' }, 'json')).toEqual(
    '{"type":"Entity"}'
  )

  expect(await client.execute({ type: 'Entity' })).toEqual({ type: 'Entity' })
  expect(
    await client.execute(
      { type: 'Entity' },
      {
        type: 'SoftwareSession',
        environment: { type: 'Environment', name: 'anything' }
      }
    )
  ).toEqual({ type: 'Entity' })
}
