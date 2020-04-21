import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga'
import { addressesToClients, Client, ClientType } from '../base/Client'
import { Delegator } from '../base/Delegator'
import { Listener } from '../base/Listener'
import { Manager } from '../base/Manager'
import { Queuer } from '../base/Queuer'
import { Server } from '../base/Server'
import { VsockAddress } from '../base/Transports'
import { Worker } from '../base/Worker'
import { Config } from '../config'
import { DirectClient } from '../direct/DirectClient'
import { DirectServer } from '../direct/DirectServer'
import { HttpClient } from '../http/HttpClient'
import { HttpServer } from '../http/HttpServer'
import { PipeClient } from '../pipe/PipeClient'
import { StdioClient } from '../stdio/StdioClient'
import { StdioServer } from '../stdio/StdioServer'
import { TcpClient } from '../tcp/TcpClient'
import { TcpServer } from '../tcp/TcpServer'
import { VsockServer } from '../vsock/VsockServer'
import { WebSocketClient } from '../ws/WebSocketClient'
import { WebSocketServer } from '../ws/WebSocketServer'

/**
 * Initialize an executor based on the config
 */
export async function init(config: Config): Promise<Listener> {
  // Configure log handler
  const { debug } = config
  replaceHandlers((data) =>
    defaultHandler(data, {
      maxLevel: debug ? LogLevel.debug : LogLevel.info,
      showStack: debug,
    })
  )

  // Create servers based on config options
  const { stdio, vsock, tcp, http, ws } = config
  const servers: Server[] = []
  if (stdio) servers.push(new StdioServer())
  if (vsock !== false)
    servers.push(
      new VsockServer(new VsockAddress(vsock === true ? undefined : vsock))
    )
  if (tcp !== false) servers.push(new TcpServer(tcp === true ? undefined : tcp))
  if (http !== false)
    servers.push(new HttpServer(http === true ? undefined : http))
  if (ws !== false)
    servers.push(new WebSocketServer(ws === true ? undefined : ws))

  // Client types that are available for connecting to peers
  const clientTypes: ClientType[] = [
    StdioClient,
    PipeClient,
    TcpClient,
    HttpClient,
    WebSocketClient,
  ]

  // Configure the delegator with clients for each peer
  const { peers } = config
  const clients: Client[] = [
    new DirectClient(new DirectServer(new Worker())),
    ...(await addressesToClients(peers, clientTypes)),
  ]
  const delegator = new Delegator(clients, clientTypes)

  // Configure the queue
  const queuer = new Queuer(config)

  return new Manager(servers, delegator, queuer)
}
