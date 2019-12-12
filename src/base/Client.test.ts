import { nextLogData } from '../test/nextLogData'
import { Client } from './Client'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'

/**
 * Simple test client that implements the
 * `send` method to echo back the
 * called method and arguments.
 */
class EchoClient extends Client {
  public send(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request
    const response = new JsonRpcResponse(id, { method, params })
    this.receive(response)
    return Promise.resolve()
  }
}

/**
 * Test that calls to client methods
 * get translated into a JSON-RPC request with
 * `method` and `params`.
 */
test('calling methods', async () => {
  const client = new EchoClient()

  expect(await client.manifest()).toEqual({
    method: 'manifest',
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

/**
 * Test that the client logs a message instead of
 * throwing an error when sent bad responses
 */
test('receiving bad response', async () => {
  const client = new EchoClient()

  // Because there is no async tick between the client receiving
  // the request and generating the log entry, we need to create
  // the promise for the next message before.
  const nextMessage = async () => (await nextLogData())[0].message
  let message

  message = nextMessage()
  // @ts-ignore that receive is protected
  client.receive('Try parsing this as JSON, client!')
  expect(await message).toMatch(/^Error parsing message as JSON/)

  message = nextMessage()
  // @ts-ignore that receive is protected
  client.receive({ id: -1 })
  expect(await message).toMatch(/^Response is missing id/)

  message = nextMessage()
  // @ts-ignore that receive is protected
  client.receive({ id: 489629879 })
  expect(await message).toMatch(/^No request found for response with id/)

  message = nextMessage()
  // @ts-ignore that requests is private
  client.requests[42] = {
    resolve: () => {
      throw Error("Yo! I'm an error")
    }
  }
  // @ts-ignore that receive is protected
  client.receive({ id: 42 })
  expect(await message).toMatch(/^Unhandled error when resolving result/)
})
