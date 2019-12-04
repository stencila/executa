import { getLogger } from '@stencila/logga'
import { Executor, Method } from './Executor'
import { InternalError } from './InternalError'
import { JsonRpcRequest } from './JsonRpcRequest'
import { JsonRpcResponse } from './JsonRpcResponse'
import { JsonRpcError } from './JsonRpcError'
import { Transport, TcpAddressInitializer, parseTcpAddress, AddressInitializer, parseAddress } from './Transports'

const log = getLogger('executa:client')

interface Request<Type> {
  id: number
  date: Date
  resolve: (result: Type) => void
  reject: (error: Error) => void
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
   * @override Overrides {@link Executor.notify} by sending a notification
   * to the remote `Executor` that this client is connected to.
   */
  public notify(level: string, message: string) {
    const notification = new JsonRpcRequest(level, { message }, false)
    this.send(notification)
  }

  /**
   * Send a request to the server.
   *
   * This method must be overriden by derived client classes to
   * send the request over the transport used by that class.
   *
   * @param request The JSON-RPC request
   */
  protected abstract send(request: JsonRpcRequest): void

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
      return this.notified(method, args[0], args[1])
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

    if (error !== undefined) reject(JsonRpcError.toError(error))
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

export interface ClientType {
  new (address: any): Client
  discover: (address?: string) => Client[]
}

const clientTypeTransportMap: { [key: string]: Transport } = {
  'DirectClient': Transport.direct,
  'StdioClient': Transport.stdio,
  'VsockClient': Transport.vsock,
  'TcpClient': Transport.tcp,
  'HttpClient': Transport.http,
  'WebSocketClient': Transport.ws
}

export function clientTypeToTransport (client: string | Function): Transport {
  const name = typeof client === 'string' ? client : client.name
  const transport = clientTypeTransportMap[name]
  if (transport !== undefined) return transport
  //  istanbul ignore next
  throw new InternalError(
    `Wooah! A key is missing for client name "${name}" in transport map.`
  )
}

export function transportToClientType (transport: Transport): string {
  for (const [name, trans] of Object.entries(clientTypeTransportMap)) {
    if (transport === trans) return name
  }
  //  istanbul ignore next
  throw new InternalError(
    `OMG! An entry is missing for transport "${transport}" in transport map.`
  )
}

export function addressToClient (addressInitializer: string, clientTypes: ClientType[]): Client | undefined {
  const address = parseAddress(addressInitializer)
  if (address === undefined) return

  const clientTypeName = transportToClientType(address.type)
  const clientType = clientTypes.filter(clientType => clientType.name === clientTypeName)[0]
  if (clientType === undefined) return

  else return new clientType(address)
}

export function addressesToClients (addresses: string[], clientTypes: ClientType[]): Client[] {
  return addresses.reduce((clients: Client[], address) => {
    const client = addressToClient(address, clientTypes)
    return client !== undefined ? [...clients, client] : clients
  }, [])
}
