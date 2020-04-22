import fetch from 'cross-fetch'
import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { HttpAddress, HttpAddressInitializer } from '../base/Transports'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:http:client')

/**
 * A `Client` using HTTP/S for communication.
 */
export class HttpClient extends Client {
  /**
   * The address of the server to connect to.
   */
  public readonly address: HttpAddress

  /**
   * Construct a `HttpClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(address: HttpAddressInitializer = new HttpAddress()) {
    super('ht')
    this.address = new HttpAddress(address)
  }

  protected send(request: JsonRpcRequest): Promise<void> {
    const { protocol, jwt } = this.address
    const { id, method, params } = request

    const baseUrl = this.address.url()
    let url
    let body
    if (protocol === 'restful') {
      url = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}${method}`
      body = params
    } else {
      url = baseUrl
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
        ...(jwt !== undefined ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    })
      .then(async (reply) => {
        // Ensure that the response id is the same as
        // the request id
        let response
        try {
          response = await reply.json()
        } catch {
          response = {}
        }
        if (protocol === 'restful') {
          let result, error
          if (reply.status >= 400) error = response
          else result = response
          return { id, result, error }
        } else return { ...response, id }
      })
      .then((response: JsonRpcResponse) => {
        this.receive(response)
      })
      .catch((err) => log.error(err))
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
