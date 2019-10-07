import Client from './Client'
import Request from './Request';
import Response from './Response';

/**
 * Simple test client that implements the
 * necessary `send` method to echo back the
 * called method and parameters.
 */
class TestClient extends Client {
  send(request: Request) {
    const { id, method, params } = request
    const response = new Response(id, { method, params })
    this.receive(response)
  }
}

test('client', async () => {
  const client = new TestClient()

  expect(await client.capabilities()).toEqual({
    method: 'capabilities',
    params: []
  })

  expect(await client.convert('{}')).toEqual({
    method: 'convert',
    params: ['{}', 'json', 'json']
  })

  expect(await client.compile({})).toEqual({
    method: 'compile',
    params: [{}, 'json']
  })

  expect(await client.build({})).toEqual({
    method: 'build',
    params: [{}, 'json']
  })

  expect(await client.execute({})).toEqual({
    method: 'execute',
    params: [{}, 'json']
  })
})
