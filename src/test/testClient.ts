import { Client } from '../base/Client'
import { JsonRpcError, JsonRpcErrorCode } from '../base/JsonRpcError'
import { Method } from '../base/Executor'
import { HttpClient } from '../http/HttpClient'

/**
 * Test that the methods of a client (that is connected to a server)
 * work as expected. This function is designed to be used to test
 * all classes that extend `Client`.
 *
 * @param client An instance of a `Client`
 */
export const testClient = async (client: Client): Promise<void> => {
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
        environment: { type: 'SoftwareEnvironment', name: 'anything' }
      }
    )
  ).toEqual({ type: 'Entity' })

  /**
   * Check that erroneous requests return a `JsonRpcError`.
   */

  const methodNotFound =
    client instanceof HttpClient && client.protocol === 'restful'
      ? new JsonRpcError(
          JsonRpcErrorCode.InvalidRequest,
          'Route not found: "/foo"'
        )
      : new JsonRpcError(
          JsonRpcErrorCode.MethodNotFound,
          'Method not found: "foo"'
        )
  // @ts-ignore unknown method
  await expect(client.call('foo')).rejects.toEqual(methodNotFound)

  await expect(client.call(Method.execute)).rejects.toEqual(
    new JsonRpcError(
      JsonRpcErrorCode.InvalidParams,
      'Invalid params: "node" is missing'
    )
  )
}
