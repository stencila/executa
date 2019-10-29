import fetch from 'cross-fetch'
import { Client } from '../base/Client'
import { JsonRpcError } from '../base/JsonRpcError'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { HttpAddress } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:http:client')

/**
 * A `Client` using HTTP/S for communication.
 */
export class HttpClient extends Client {
  public readonly url: string

  private readonly jwt?: string

  public readonly protocol: 'jsonrpc' | 'restful'

  public constructor(address: HttpAddress = new HttpAddress()) {
    super()

    const {
      host = '127.0.1.1',
      port = '8000',
      path = '',
      jwt,
      protocol
    } = address
    this.url = `http://${host}:${port}${path.startsWith('/') ? '' : '/'}${path}`
    this.jwt = jwt
    this.protocol = protocol
  }

  protected send(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request

    let url
    let body
    if (this.protocol === 'jsonrpc') {
      url = this.url
      body = request
    } else {
      url = `${this.url}${this.url.endsWith('/') ? '' : '/'}${method}`
      body = params
    }

    return fetch(url, {
      method: 'POST',
      mode: 'cors', // no-cors, cors, *same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8',
        ...(this.jwt !== undefined
          ? { Authorization: `Bearer ${this.jwt}` }
          : {})
      },
      body: JSON.stringify(body)
    })
      .then(async reply => {
        if (reply.status >= 400) {
          // Translate the HTTP error into JSON-RPC error
          const message = await reply.text()
          const error = new JsonRpcError(-32600, message)
          return new JsonRpcResponse(id, undefined, error)
        }
        if (this.protocol === 'jsonrpc') return reply.json()
        else return new JsonRpcResponse(id, reply.json())
      })
      .then((response: JsonRpcResponse) => {
        this.receive(response)
      })
      .catch(err => log.error(err))
  }
}
