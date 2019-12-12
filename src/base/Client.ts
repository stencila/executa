import { getLogger } from '@stencila/logga'
import { Executor, Method, Manifest } from './Executor'
import { InternalError } from './InternalError'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { JsonRpcError } from './JsonRpcError'
import { Transport, parseAddress, Address } from './Transports'

const log = getLogger('executa:client')

interface Request<Type> {
  id: number
  date: Date
  resolve: (result: Type) => void
  reject: (error: Error) => void
}

interface Notification {
  id: number
  date: Date
  subject: string
  message: string
}

/**
 * A client to a remote, out of process, `Executor`.
 *
 * Implements asynchronous, methods for `Executor` methods `call` and `notify`
 * which send JSON-RPC requests to a `Server` that is serving the remote `Executor`.
 */
export abstract class Client extends Executor {
  /**
   * A map of requests to which responses can be paired against
   */
  private requests: { [key: number]: Request<any> } = {}

  /**
   * A cached manifest from the remote executor.
   */
  manifestCached: Manifest | undefined

  /**
   * Notifications cache
   *
   * Intended to be consumed by by applications
   * e.g. by displaying them to the user.
   */
  notifications: Notification[] = []

  /**
   * Count of notifications received
   *
   * Used to give a unique, sequential, identifier to each
   * new notification.
   */
  notificationsCount = 0

  /**
   * Maximum length of the notifications cache
   *
   * Used to avoid excessive memory usage for unhandled
   * notifications.
   */
  notificationsLength = 1000

  /**
   * Construct a `Client`.
   *
   * @param family The two letter prefix for the id of this client
   */
  public constructor(family = 'cli') {
    super(family)
  }

  /**
   * @override Override of {@link Executor.manifest} to
   * return the manifest of the remote executor.
   */
  public async manifest() {
    if (this.manifestCached === undefined) {
      this.manifestCached = await this.call<Manifest>(Method.manifest)
    }
    return this.manifestCached
  }

  /**
   * @implements Implements {@link Executor.call} by sending a
   * a request to the remote `Executor` that this client is connected to.
   */
  public async call<Type>(
    method: Method,
    params: { [key: string]: any } = {}
  ): Promise<Type> {
    const request = new JsonRpcRequest(method, params)
    const id = request.id
    if (id === undefined)
      throw new InternalError('Request should have id defined')

    const promise = new Promise<Type>((resolve, reject) => {
      this.requests[id] = {
        id,
        date: new Date(),
        resolve,
        reject
      }
    })
    await this.send(request)
    return promise
  }

  /**
   * @override Override of {@link Executor.notify} to send a notification
   * to the `Executor` that this client is connected to.
   */
  public notify(subject: string, message: string): Promise<void> {
    const notification = new JsonRpcRequest(subject, { message }, false)
    return this.send(notification)
  }

  /**
   * @override Override of {@link Executor.notified} to cache
   * notifications received by this client instead on just
   * logging them.
   */
  notified(subject: string, message: string): void {
    const { notifications, notificationsLength } = this
    this.notificationsCount += 1
    notifications.push({
      id: this.notificationsCount,
      date: new Date(),
      subject,
      message
    })
    if (notifications.length > notificationsLength) {
      notifications.splice(0, notifications.length - notificationsLength)
    }
  }

  /**
   * Send a request to the server.
   *
   * This method must be overridden by derived client classes to
   * send the request over the transport used by that class.
   *
   * @param request The JSON-RPC request
   */
  protected abstract send(request: JsonRpcRequest): Promise<void>

  /**
   * Receive a response from the server.
   *
   * Usually called asynchronously via the `send` method of a derived class
   * when a response is returned. Uses the `id` of the response to match it to the corresponding
   * request and resolve it's promise.
   *
   * Logs errors, rather than throwing exceptions, if the server sends a bad
   * response because this method is called asynchronously when a message
   * is received and to avoid crashing the process.
   *
   * @param message A JSON-RPC response (to a request) or a notification.
   */
  protected receive(message: string | JsonRpcResponse | JsonRpcRequest): void {
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message) as JsonRpcResponse | JsonRpcRequest
      } catch (error) {
        log.error(`Error parsing message as JSON: ${message}`)
        return
      }
    }
    const { id } = message

    if (id === undefined) {
      // A notification request
      const { method, params = [] } = message as JsonRpcRequest
      const args = Object.values(params)
      return this.notified(method, args[0])
    }

    // Must be a response....

    if (id < 0) {
      // A response with accidentally missing id
      log.error(`Response is missing id: ${JSON.stringify(message)}`)
      return
    }

    const request = this.requests[id]
    if (request === undefined) {
      log.error(`No request found for response with id: ${id}`)
      return
    }

    const { resolve, reject } = request
    const { result, error } = message as JsonRpcResponse

    if (!(error === null || error === undefined))
      reject(JsonRpcError.toError(error))
    else {
      try {
        resolve(result)
      } catch (error) {
        log.error(`Unhandled error when resolving result: ${error}`)
      }
    }

    delete this.requests[id]
  }
}

/**
 * Interface for a client type.
 */
export interface ClientType {
  /**
   * Construct a client of this type.
   */
  new (address: any): Client

  /**
   * Discover servers for this type of client.
   *
   * This static method should be implemented by
   * client classes and return an array of clients
   * having that type.
   */
  discover: (address?: string) => Promise<Client[]>
}

const clientTypeTransportMap: { [key: string]: Transport } = {
  DirectClient: Transport.direct,
  StdioClient: Transport.stdio,
  VsockClient: Transport.vsock,
  TcpClient: Transport.tcp,
  HttpClient: Transport.http,
  WebSocketClient: Transport.ws
}

/**
 * Get the transport for a client type
 *
 * @param client The client type name, constructor or instance
 */
export function clientTypeToTransport(
  client: string | Function | Client
): Transport | undefined {
  const name =
    typeof client === 'string'
      ? client
      : typeof client === 'function'
      ? client.name
      : client.constructor.name
  const transport = clientTypeTransportMap[name]
  if (transport !== undefined) return transport

  // If this happens, it's likely due to a missing
  // entry in the above `clientTypeTransportMap`.
  log.error(`Client type not in map: ${name}`)
  return undefined
}

/**
 * Get the client type for a transport.
 *
 * @param transport The transport to translate.
 */
export function transportToClientType(
  transport: Transport | string
): string | undefined {
  for (const [name, trans] of Object.entries(clientTypeTransportMap)) {
    if (transport === trans) return name
  }

  // If this happens, it could be due to missing entry
  // in `clientTypeTransportMap`, or a bad string from by user
  log.error(`Unrecognized address transport: ${transport}`)
  return undefined
}

/**
 * Translate an address string into one or more clients.
 *
 * If the address is a "discovery address" e.g. `stdio://*`
 * then discovery for the transport will be done and zero
 * or more clients returns. For other addresses, a single
 * client will be returned, unless there is an error in the
 * address in which case none will be returned.
 *
 * @param addressStr Address string to translate.
 * @param clientTypes Array of client types available to be translated to.
 */
export function addressToClients(
  addressStr: string,
  clientTypes: ClientType[]
): Promise<Client[]> {
  let address: Address | undefined
  let transport: Transport | string

  // Check if this is a discovery address (e.g. `stdio://*`)
  const match = /^([a-z]{2,}):\/\/\*/.exec(addressStr)
  if (match !== null) {
    transport = match[1]
  } else {
    address = parseAddress(addressStr)
    if (address === undefined) {
      log.error(`Unable to parse address: ${addressStr}`)
      return Promise.resolve([])
    }
    transport = address.type
  }

  const clientTypeName = transportToClientType(transport)
  if (clientTypeName === undefined) {
    return Promise.resolve([])
  }

  const ClientType = clientTypes.filter(
    clientType => clientType.name === clientTypeName
  )[0]
  if (ClientType === undefined) {
    log.error(`Client type not available: ${clientTypeName}`)
    return Promise.resolve([])
  }

  // If a discovery address then  do discovery, otherwise return a single client
  return address === undefined
    ? ClientType.discover()
    : Promise.resolve([new ClientType(address)])
}

/**
 * Translate an array of address strings into an array of
 * clients.
 *
 * @param addresses Array of address strings to translate.
 * @param clientTypes Array of client types available to be translated to.
 */
export function addressesToClients(
  addresses: string[],
  clientTypes: ClientType[]
): Promise<Client[]> {
  return addresses.reduce(
    async (clients: Promise<Client[]>, address: string) => {
      return [
        ...(await clients),
        ...(await addressToClients(address, clientTypes))
      ]
    },
    Promise.resolve([])
  )
}
