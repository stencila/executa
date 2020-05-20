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

test('WebSocketClient and WebSocketServer', async () => {
  let serverLogs: LogData[] = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:ws:server') {
      serverLogs = [...serverLogs, logData]
    }
  })

  let clientLogs: LogData[] = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:ws:client') {
      clientLogs = [...clientLogs, logData]
    }
  })

  const server = new WebSocketServer()
  const executor = new EchoExecutor()
  await server.start(executor)

  // @ts-ignore that connections is private
  const serverConnections = () => Object.values(server.connections).length

  {
    // Well behaved client
    const client = new WebSocketClient(server.address)
    await testClient(client)
    await client.stop()
  }

  await delay(25)
  expect(serverConnections()).toBe(0)

  {
    // JWT with session limits to be used for begin() method
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
  }

  await delay(25)
  expect(serverConnections()).toBe(0)

  {
    // Client with malformed JWT
    clientLogs = []
    const client = new WebSocketClient({ ...server.address, jwt: 'what?' })
    await client.start()
    await delay(25)
    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBe(1)
    expect(clientLogs[0].message).toMatch(/Failed to authenticate with server/)
    await client.stop()
  }

  {
    // Client with invalid JWT
    clientLogs = []
    const client = new WebSocketClient({
      ...server.address,
      jwt: JWT.sign({}, 'not-the-right-secret'),
    })
    await client.start()
    await delay(25)
    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBe(1)
    expect(clientLogs[0].message).toMatch(/Failed to authenticate with server/)
    await client.stop()
  }

  {
    // Clients reconnect after disconnection
    const client1 = new WebSocketClient(server.address)
    const client2 = new WebSocketClient(server.address)
    const client3 = new WebSocketClient(server.address)

    expect(serverConnections()).toBe(0)

    await client1.start()
    await client2.start()
    await client3.start()
    await delay(25)
    expect(serverConnections()).toBe(3)

    clientLogs = []

    await server.stop()
    expect(serverConnections()).toBe(0)

    await server.start(new Worker())
    await delay(100)

    expect(serverConnections()).toBe(3)
    expect(clientLogs.length).toBe(3)
    expect(clientLogs[0].message).toMatch(
      /Connection closed, trying to reconnect/
    )

    await client1.stop()
    await client2.stop()
    await client3.stop()

    await delay(25)
    expect(serverConnections()).toBe(0)
  }

  {
    // Sending notifications to several clients
    const client1 = new WebSocketClient(server.address)
    const client2 = new WebSocketClient(server.address)
    const client3 = new WebSocketClient(server.address)

    await client1.start()
    await client2.start()
    await client3.start()
    await delay(25)

    // Server notification to several clients
    server.notify('debug', 'To all clients')
    await delay(25)
    expect(client1.notifications.length).toBe(1)
    expect(client2.notifications.length).toBe(1)
    expect(client3.notifications.length).toBe(1)

    // Server notification to some clients
    // @ts-ignore that connections is protected
    const clients = Object.keys(server.connections).slice(0, 2)
    server.notify('debug', 'To some clients', undefined, clients)
    await delay(25)
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
    await delay(25)
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
    await delay(25)
    expect(serverLogs.length).toBe(0)
    expect(clientLogs[0].message).toMatch(
      /Message received while socket was closing/
    )
    expect(client1.notifications.length).toBe(2)
    expect(client2.notifications.length).toBe(2)
    expect(client3.notifications.length).toBe(2)
  }

  await server.stop()
})

jest.setTimeout(5 * 60 * 1000)

test.only('Large Websocket message sizes', async () => {
  const server = new WebSocketServer()
  const client = new WebSocketClient(server.address)

  const executor = new Worker()
  await server.start(executor)

  for (let exponent = 1; exponent < 20; exponent++) {
    for (let replicate = 0; replicate < 10; replicate++) {
      const size = Math.pow(2, exponent)
      console.log(exponent, size, replicate)
      const sent = `${exponent},${replicate}:` + '-'.repeat(size)
      const received = await client.decode(`"${sent}"`, 'json')
      expect(received).toBe(sent)
    }
  }

  await client.stop()
  await server.stop()
})
