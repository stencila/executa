import { addHandler, LogData } from '@stencila/logga'
import { softwareEnvironment, softwareSession } from '@stencila/schema'
import JWT from 'jsonwebtoken'
import { User } from '../base/Executor'
import { EchoExecutor } from '../test/EchoExecutor'
import { testClient } from '../test/testClient'
import { WebSocketClient } from './WebSocketClient'
import { WebSocketServer } from './WebSocketServer'
import { delay } from '../test/delay'

const JWT_SECRET = 'not-a-secret-at-all'

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET
})

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

  let clientNotifs: LogData[] = []
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:client:notifs') {
      clientNotifs = [...clientNotifs, logData]
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

  await delay(10)
  expect(serverConnections()).toBe(0)

  {
    // JWT with session limits to be used for begin() method
    const sessionRequests = softwareSession({
      environment: softwareEnvironment('some-eviron'),
      cpuRequest: 4,
      memoryRequest: 5
    })
    const user: User = {
      session: softwareSession({
        environment: softwareEnvironment('some-eviron'),
        cpuLimit: 2,
        memoryLimit: 2
      })
    }
    const jwt = JWT.sign(user, JWT_SECRET)
    const client = new WebSocketClient({ ...server.address, jwt })
    const echoed = (await client.begin(sessionRequests)) as any
    expect(echoed.node).toEqual(sessionRequests)

    const userclient = echoed.user.client
    expect(userclient.type).toEqual('ws')
    expect(userclient).toHaveProperty('id')

    await client.stop()
  }

  await delay(10)
  expect(serverConnections()).toBe(0)

  {
    // Client with malformed JWT
    clientLogs = []
    const client = new WebSocketClient(
      { ...server.address, jwt: 'jwhaaaat?' },
      'malformed-jwt'
    )
    await delay(10)
    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBe(1)
    expect(clientLogs[0].message).toMatch(
      /Failed to authenticate with server: jwt malformed/
    )
    await client.stop()
  }

  {
    // Client with invalid JWT
    clientLogs = []
    const client = new WebSocketClient(
      {
        ...server.address,
        jwt: JWT.sign({}, 'not-the-right-secret')
      },
      'invalid-jwt'
    )
    await delay(10)
    expect(serverConnections()).toBe(0)
    expect(clientLogs.length).toBe(1)
    expect(clientLogs[0].message).toMatch(
      /Failed to authenticate with server: invalid signature/
    )
    await client.stop()
  }

  {
    // Clients reconnect after disconnection
    const client1 = new WebSocketClient(server.address, 'client1')
    const client2 = new WebSocketClient(server.address, 'client2')
    const client3 = new WebSocketClient(server.address, 'client3')
    await delay(10)
    expect(serverConnections()).toBe(3)

    clientLogs = []

    await server.stop()
    expect(serverConnections()).toBe(0)

    await server.start()
    await delay(10)

    expect(serverConnections()).toBe(3)
    expect(clientLogs.length).toBe(3)
    expect(clientLogs[0].message).toMatch(
      /Connection closed, trying to reconnect/
    )

    await client1.stop()
    await client2.stop()
    await client3.stop()

    await delay(10)
    expect(serverConnections()).toBe(0)
  }

  {
    // Sending notifications to several clients
    const client1 = new WebSocketClient(server.address)
    const client2 = new WebSocketClient(server.address)
    const client3 = new WebSocketClient(server.address)
    await delay(10)

    // Server notification to several clients
    clientNotifs = []
    server.notify('debug', 'To all clients')
    await delay(10)
    expect(clientNotifs.length).toBe(3)

    // Server notification to some clients
    // @ts-ignore that connections is protected
    const clients = Object.keys(server.connections).slice(0, 2)
    clientNotifs = []
    server.notify('debug', 'To all clients', undefined, clients)
    await delay(10)
    expect(clientNotifs.length).toEqual(clients.length)

    // Server notification after clients disconnect
    await client1.stop()
    await client2.stop()

    serverLogs = []
    clientLogs = []
    clientNotifs = []
    server.notify('debug', 'Hello, who is still there?')
    // Server has sent notification to 2 closing sockets
    await delay(10)
    expect(serverLogs.length).toBe(0)
    expect(clientLogs[0].message).toMatch(
      /Message received while socket was closing/
    )
    expect(clientNotifs.length).toBe(1)

    await client3.stop()

    serverLogs = []
    clientLogs = []
    clientNotifs = []
    server.notify('debug', 'Anybody?')
    // Server has sent notification to 2 closed sockets and one closing
    await delay(10)
    expect(serverLogs.length).toBe(0)
    expect(clientLogs[0].message).toMatch(
      /Message received while socket was closing/
    )
    expect(clientNotifs.length).toBe(0)
  }

  await server.stop()
})
