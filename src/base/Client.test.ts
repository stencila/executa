import { Client } from './Client'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { addHandler, LogData } from '@stencila/logga'
import { delay } from '../test/delay'

/**
 * Simple test client that implements the
 * `send` to echo back the
 * called method and arguments.
 */
class TestClient extends Client {
  public send(request: JsonRpcRequest): void {
    const { id, method, params } = request
    const response = new JsonRpcResponse(id, { method, params })
    this.receive(response)
  }
}

/**
 * Test that calls to client methods
 * get translated into a JSON-RPC request with
 * `method` and `params`.
 */
test('calling methods', async () => {
  const client = new TestClient()

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
  const client = new TestClient()

  let clientLogs: LogData[] = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:client') {
      clientLogs = [...clientLogs, logData]
    }
  })

  // @ts-ignore that receive is protected
  client.receive('Try parsing this as JSON, client!')
  await delay(25)
  expect(clientLogs.length).toBe(1)
  expect(clientLogs[0].message).toMatch(/^Error parsing message as JSON/)

  // @ts-ignore that receive is protected
  client.receive({ id: -1 })
  await delay(25)
  expect(clientLogs.length).toBe(2)
  expect(clientLogs[1].message).toMatch(/^Response is missing id/)

  // @ts-ignore that receive is protected
  client.receive({ id: 489629879 })
  await delay(25)
  expect(clientLogs.length).toBe(3)
  expect(clientLogs[2].message).toMatch(
    /^No request found for response with id/
  )

  // @ts-ignore that requests is private
  client.requests[42] = () => {
    throw Error("Yo! I'm an error")
  }
  // @ts-ignore that receive is protected
  client.receive({ id: 42 })
  await delay(25)
  expect(clientLogs.length).toBe(4)
  expect(clientLogs[3].message).toMatch(/^Error thrown when handling message/)
})
