import { addHandler, LogData } from '@stencila/logga'
import * as schema from '@stencila/schema'
import JWT from 'jsonwebtoken'
import { Claims } from '../base/Executor'
import { EchoExecutor } from '../test/EchoExecutor'
import { testClient } from '../test/testClient'
import { WebSocketClient } from './WebSocketClient'
import { WebSocketServer } from './WebSocketServer'
import { delay } from '../test/delay'
import { Worker } from '../base/Worker'

// During these tests it is necessary to wait for servers to start
// and messages to get passed etc. Wait longer on CI to avoid
// unnecessary failures.
const delayMilliseconds = process.env.CI !== undefined ? 100 : 25

let server: WebSocketServer
let serverLogs: LogData[] = []
let clientLogs: LogData[] = []

// @ts-ignore that connections is private
const serverConnections = () => Object.values(server.connections).length

beforeEach(() => {
  server = new WebSocketServer()
  const executor = new EchoExecutor()

  serverLogs = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:ws:server') {
      serverLogs = [...serverLogs, logData]
    }
  })

  clientLogs = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:ws:client') {
      clientLogs = [...clientLogs, logData]
    }
  })

  return server.start(executor)
})

afterEach(() => server.stop())

describe('WebSocketClient and WebSocketServer', () => {
  test('Well behaved client', async () => {
    const client = new WebSocketClient(server.address)
    await testClient(client)
    await client.stop()

    await delay(delayMilliseconds)
    expect(serverConnections()).toBe(0)
  })

  test('JWT with session limits to be used for begin() method', async () => {
    const sessionRequests = schema.softwareSession({
      environment: schema.softwareEnvironment({ name: 'some-environment' }),
      cpuRequest: 4,
      memoryRequest: 5,
    })
    const claims: Claims = {
      session: schema.softwareSession({
        environment: schema.softwareEnvironment({ name: 'some-environment' }),
        cpuLimit: 2,
        memoryLimit: 2,
      }),
    }

    // Sign with the server's secret
    const jwt = JWT.sign(claims, server.jwtSecret)
    const client = new WebSocketClient({ ...server.address, jwt })
    const echoed = (await client.begin(sessionRequests)) as any
    expect(echoed.node).toEqual(sessionRequests)

    const userClient = echoed.claims.client
    expect(userClient.type).toEqual('ws')
    expect(userClient).toHaveProperty('id')

    await client.stop()

    await delay(delayMilliseconds)
    expect(serverConnections()).toBe(0)
  })

  test('Client with malformed JWT', async () => {
    const client = new WebSocketClient({ ...server.address, jwt: 'what?' })
    await client.start()
    await delay(delayMilliseconds)

    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBeGreaterThanOrEqual(1)
    expect(clientLogs[0].message).toMatch(/Failed to authenticate with server/)
    await client.stop()
  })

  test('Client with invalid JWT', async () => {
    const client = new WebSocketClient({
      ...server.address,
      jwt: JWT.sign({}, 'not-the-right-secret'),
    })
    await client.start()
    await delay(delayMilliseconds)
    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBeGreaterThanOrEqual(1)
    expect(clientLogs[0].message).toMatch(/Failed to authenticate with server/)
    await client.stop()
  })

  test('Clients reconnect after disconnection', async () => {
    const client1 = new WebSocketClient(server.address)
    const client2 = new WebSocketClient(server.address)
    const client3 = new WebSocketClient(server.address)

    expect(serverConnections()).toBe(0)

    await client1.start()
    await client2.start()
    await client3.start()
    await delay(delayMilliseconds)
    expect(serverConnections()).toBe(3)

    await server.stop()
    expect(serverConnections()).toBe(0)

    await server.start(new Worker())
    await delay(delayMilliseconds)

    expect(serverConnections()).toBe(3)
    expect(clientLogs.length).toBeGreaterThanOrEqual(3)
    expect(clientLogs[0].message).toMatch(
      /Connection closed, trying to reconnect/
    )

    await client1.stop()
    await client2.stop()
    await client3.stop()

    await delay(delayMilliseconds)
    expect(serverConnections()).toBe(0)
  })

  test('Sending notifications to several clients', async () => {
    const client1 = new WebSocketClient(server.address)
    const client2 = new WebSocketClient(server.address)
    const client3 = new WebSocketClient(server.address)

    await client1.start()
    await client2.start()
    await client3.start()
    await delay(delayMilliseconds)

    // Server notification to several clients
    server.notify('debug', 'To all clients')
    await delay(delayMilliseconds)
    expect(client1.notifications.length).toBe(1)
    expect(client2.notifications.length).toBe(1)
    expect(client3.notifications.length).toBe(1)

    // Server notification to some clients
    // @ts-ignore that connections is protected
    const clients = Object.keys(server.connections).slice(0, 2)
    server.notify('debug', 'To some clients', undefined, clients)
    await delay(delayMilliseconds)
    expect(client1.notifications.length).toBe(2)
    expect(client2.notifications.length).toBe(2)
    expect(client3.notifications.length).toBe(1)

    // Server notification after clients disconnect
    await client1.stop()
    await client2.stop()

    serverLogs = []
    clientLogs = []
    server.notify('debug', 'Hello, who is still there?')
    // Server has sent notification to 2 closing sockets
    await delay(delayMilliseconds)
    expect(serverLogs.length).toBe(0)
    expect(clientLogs[0].message).toMatch(
      /Message received while socket was closing/
    )
    expect(client1.notifications.length).toBe(2)
    expect(client2.notifications.length).toBe(2)
    expect(client3.notifications.length).toBe(2)

    await client3.stop()

    serverLogs = []
    clientLogs = []
    server.notify('debug', 'Anybody?')
    // Server has sent notification to 2 closed sockets and one closing
    await delay(delayMilliseconds)
    expect(serverLogs.length).toBe(0)
    expect(clientLogs[0].message).toMatch(
      /Message received while socket was closing/
    )
    expect(client1.notifications.length).toBe(2)
    expect(client2.notifications.length).toBe(2)
    expect(client3.notifications.length).toBe(2)
  })
})

test('Many messages of increasing sizes', async () => {
  // A regression test for https://github.com/stencila/executa/issues/141/
  jest.setTimeout(60 * 1000)

  const client = new WebSocketClient(server.address)

  const maxExponent = 25
  const maxReplicate = 10
  let exponent
  let replicate
  for (exponent = 1; exponent < maxExponent; exponent++) {
    for (replicate = 0; replicate < maxReplicate; replicate++) {
      const size = Math.pow(2, exponent)
      const sent = `${exponent},${replicate}:` + '-'.repeat(size)
      const received = await client.decode(`"${sent}"`, 'json')
      expect(received).toBe(sent)
    }
  }
  expect(exponent).toBe(maxExponent)
  expect(replicate).toBe(maxReplicate)

  await client.stop()
})
