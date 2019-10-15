import fetch from 'cross-fetch'
import Client from '../base/Client'
import Request from '../base/Request'
import { HttpAddress, TcpAddressInitializer } from '../base/Transports'
import Response from '../base/Response'
import JsonRpcError from '../base/Error'

/**
 * A `Client` using HTTP/S for communication.
 */
export default class HttpClient extends Client {
  public readonly url: string

  private readonly jwt?: string

  public constructor(address: HttpAddress = new HttpAddress()) {
    super()

    this.url = address.toString()
    this.jwt = address.jwt
  }

  protected send(request: Request): Promise<void> {
    return fetch(this.url, {
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
      body: JSON.stringify(request)
    })
      .then(async reply => {
        if (reply.status >= 400) {
          // Translate the HTTP error into JSON-RPC error
          const message = await reply.text()
          const error = new JsonRpcError(-32600, message)
          return new Response(request.id, undefined, error)
        }
        return reply.json()
      })
      .then((response: Response) => {
        this.receive(response)
      })
  }

  // Additional methods for getting and posting to server

  /**
   * Make a GET request to the server
   *
   * @param path Path to request
   */
  public async get(path: string) {
    return fetch(this.url + '/' + path)
  }

  /**
   * Make a POST request to the server
   *
   * @param path  Path to request
   * @param data Data to POST in the request body
   */
  public async post(path: string, data?: {}) {
    return fetch(this.url + '/' + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8'
      },
      body: JSON.stringify(data)
    }).then(response => response.json())
  }
}
