import fetch from 'cross-fetch'
import { Client } from '../base/Client'
import { JsonRpcError } from '../base/JsonRpcError'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { HttpAddress, HttpAddressInitializer } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:http:client')

/**
 * A `Client` using HTTP/S for communication.
 */
export class HttpClient extends Client {
  public readonly url: string

  private readonly jwt: HttpAddress['jwt']

  public readonly protocol: HttpAddress['protocol']

  public constructor(address: HttpAddressInitializer = new HttpAddress()) {
    super()

    const httpAddress = new HttpAddress(address)
    this.url = httpAddress.url()
    this.jwt = httpAddress.jwt
    this.protocol = httpAddress.protocol
  }

  protected send(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request

    let url
    let body
    if (this.protocol === 'restful') {
      url = `${this.url}${this.url.endsWith('/') ? '' : '/'}${method}`
      body = params
    } else {
      url = this.url
      body = request
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
        // Ensure that the response id is the same as
        // the request id
        let response
        try {
          response = await reply.json()
        } catch {
          response = {}
        }
        if (this.protocol === 'restful') {
          let result, error
          if (reply.status >= 400) error = response
          else result = response
          return { id, result, error }
        } else return { ...response, id }
      })
      .then((response: JsonRpcResponse) => {
        this.receive(response)
      })
      .catch(err => log.error(err))
  }

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Not implemented yet. In the future
   * could be implemented using port scanning on the
   * localhost.
   */
  static discover(): Promise<HttpClient[]> {
    log.warn('Discovery not available for HTTP client')
    return Promise.resolve([])
  }
}
