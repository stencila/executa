import Client from './Client'
import Request from './Request'
import Response from './Response'

/**
 * Simple test client that implements the
 * `send` to echo back the
 * called method and arguments.
 */
class TestClient extends Client {
  public send(request: Request): void {
    const { id, method, params } = request
    const response = new Response(id, { method, params })
    this.receive(response)
  }
}

test('client', async () => {
  const client = new TestClient()

  expect(await client.capabilities()).toEqual({
    method: 'capabilities',
    params: {}
  })

  expect(await client.decode('the content', 'the format')).toEqual({
    method: 'decode',
    params: {
      content: 'the content',
      format: 'the format'
    }
  })

  expect(await client.compile({ type: 'Entity' })).toEqual({
    method: 'compile',
    params: {
      node: { type: 'Entity' }
    }
  })

  expect(await client.build({ type: 'Entity' })).toEqual({
    method: 'build',
    params: {
      node: { type: 'Entity' }
    }
  })

  expect(await client.execute({ type: 'Entity' })).toEqual({
    method: 'execute',
    params: {
      node: { type: 'Entity' }
    }
  })
})
