import { Client } from '../base/Client'
import { JsonRpcError, JsonRpcErrorCode } from '../base/JsonRpcError'
import { Method } from '../base/Executor'
import { HttpClient } from '../http/HttpClient'
import { CapabilityError } from '../base/errors'

/**
 * Test that a client works as expected.
 *
 * This function is designed to be used to test
 * all classes that extend `Client` and that are
 * connected to a `Server` serving a `Worker`.
 * It tests that various methods work
 * over the transport protocol that the client is using.
 *
 * @param client An instance of a `Client`
 */
export const testClient = async (client: Client): Promise<void> => {
  const expr = {
    type: 'CodeExpression',
    programmingLanguage: 'js',
    text: '6 * 7'
  }

  /**
   * Check that calls to methods (that the executor is
   * capable of) return the correct result
   */
  expect(await client.decode('3.14', 'json')).toEqual(3.14)
  expect(await client.encode(3.14, undefined, 'json')).toEqual('3.14')
  expect(await client.query({ a: 1 }, 'a', 'jmes-path')).toEqual(1)
  expect(await client.execute(expr)).toEqual({ ...expr, output: 42 })

  /**
   * Check that piping works
   */
  expect(
    await client.pipe(JSON.stringify(expr), [
      [Method.decode, { format: 'json' }],
      Method.execute,
      [Method.query, { query: 'output' }],
      [Method.encode, { format: 'json' }]
    ])
  ).toBe('42')

  /**
   * Check that attempt to cancel a request
   * returns false (for the `Worker` class)
   */
  expect(await client.cancel('not-a-unique-job-id')).toBe(false)

  /**
   * Check that calls to methods that the executor is not
   * capable of throw a `CapabilityError`
   */
  await expect(client.decode('', 'pdf')).rejects.toThrow(CapabilityError)

  /**
   * Check that erroneous requests return a `JsonRpcError`.
   */

  // @ts-ignore unknown method
  await expect(client.call('foo')).rejects.toEqual(
    client instanceof HttpClient && client.address.protocol === 'restful'
      ? new JsonRpcError(
          JsonRpcErrorCode.InvalidRequest,
          'Route not found: "/foo"'
        )
      : new JsonRpcError(
          JsonRpcErrorCode.MethodNotFound,
          'Method not found: "foo"'
        )
  )

  await expect(client.call(Method.execute)).rejects.toEqual(
    new JsonRpcError(
      JsonRpcErrorCode.InvalidParams,
      'Invalid params: "node" is missing'
    )
  )
}
