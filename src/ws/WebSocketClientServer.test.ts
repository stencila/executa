import { addHandler, LogData } from '@stencila/logga'
import { softwareEnvironment, softwareSession } from '@stencila/schema'
import JWT from 'jsonwebtoken'
import { User } from '../base/Executor'
import { EchoExecutor } from '../test/EchoExecutor'
import { testClient } from '../test/testClient'
import { WebSocketClient } from './WebSocketClient'
import { WebSocketServer } from './WebSocketServer'

const JWT_SECRET = 'not-a-secret-at-all'

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET
})

test('WebSocketClient and WebSocketServer', async () => {
  let clientLog: LogData = { tag: '', level: 0, message: '' }
  addHandler((logData: LogData) => {
    if (logData.tag === 'executa:ws:client') {
      clientLog = logData
    }
  })

  const server = new WebSocketServer()
  const executor = new EchoExecutor()
  await server.start(executor)

  {
    // Well behaved client
    const client = new WebSocketClient(server.address)
    await testClient(client)
    await client.stop()
  }

  {
    // JWT with session limits to be used for begin() method
    const sessionRequests = softwareSession({
      environment: softwareEnvironment('some-eviron'),
      cpuRequested: 4,
      memoryRequested: 5
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
  }

  {
    // Client with malformed JWT
    const _ = new WebSocketClient({ ...server.address, jwt: 'jwhaaaat?' })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(clientLog.message).toMatch(/Unexpected server response: 401/)
  }

  {
    // Client with invalid JWT
    const _ = new WebSocketClient({
      ...server.address,
      jwt: JWT.sign({}, 'not-the-right-secret')
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(clientLog.message).toMatch(/Unexpected server response: 401/)
  }

  await server.stop()
})
