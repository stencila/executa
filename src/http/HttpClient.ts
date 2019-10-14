import fetch from 'cross-fetch'
import Client from '../base/Client'
import Request from '../base/Request'
import { HttpAddress, TcpAddressInitializer } from '../base/Transports'

/**
 * A `Client` using HTTP/S for communication.
 */
export default class HttpClient extends Client {
  private readonly address: HttpAddress

  public constructor(address?: TcpAddressInitializer) {
    super()
    this.address = new HttpAddress(address)
  }

  public get url() {
    return this.address.toString()
  }

  protected send(request: Request): Promise<void> {
    return fetch(this.url, {
      method: 'POST',
      mode: 'cors', // no-cors, cors, *same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8'
      },
      body: JSON.stringify(request)
    })
      .then(response => response.json())
      .then(response => this.receive(response))
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
