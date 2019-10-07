import * as stencila from '@stencila/schema';
import Executor, { Method, Capabilities } from './Executor';
import Request from './Request';
import Response from './Response';

/**
 * A base client class which acts as a proxy to a remote `Executor`.
 *
 * Implements aynchronous, proxy methods for `Executor` methods `compile`, `build`, `execute`, etc.
 * Those methods send JSON-RPC requests to a `Server` that is serving the remote `Executor`.
 */
export default abstract class Client extends Executor {

  /**
   * A map of requests to which responses can be paired against
   */
  private requests: {[key: number]: (response: Request) => void } = {}

  /**
   * Call the remote `Executor`'s `capabilities` method
   */
  async capabilities (): Promise<Capabilities> {
    return this.call<Capabilities>(Method.capabilities)
  }

  /**
   * Call the remote `Executor`'s `convert` method
   */
  async convert (node: string | stencila.Node, from: string = 'json', to: string = 'json'): Promise<string> {
    return this.call<string>(Method.convert, node, from, to)
  }

  /**
   * Call the remote `Executor`'s `compile` method
   */
  async compile (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return this.call<stencila.Node>(Method.compile, node, format)
  }

  /**
   * Call the remote `Executor`'s `build` method
   */
  async build (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return this.call<stencila.Node>(Method.build, node, format)
  }

  /**
   * Call the remote `Executor`'s `execute` method
   */
  async execute (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return this.call<stencila.Node>(Method.execute, node, format)
  }

  /**
   * Call a method of a remote `Executor`.
   *
   * @param method The name of the method
   * @param args Any method arguments
   */
  private async call<Type> (method: Method, ...args: Array<any>): Promise<Type> {
    const request = new Request(method, args)
    const promise = new Promise<Type>((resolve, reject) => {
      this.requests[request.id] = (response: Response) => {
        if (response.error) return reject(new Error(response.error.message))
        resolve(response.result)
      }
    })
    this.send(request)
    return promise
  }

  /**
   * Send a request to the server.
   *
   * This method must be overriden by derived client classes to
   * send the request over the transport used by that class.
   *
   * @param request The JSON-RPC request
   */
  protected abstract send (request: Request): void

  /**
   * Receive a response from the server.
   *
   * Usually called asynchronously via the `send` method of a derived class
   * when a response is returned. Uses the `id` of the response to match it to the corresponding
   * request and resolve it's promise.
   *
   * @param response The JSON-RPC response
   */
  protected receive (response: string | Response): void {
    if (typeof response === 'string') response = JSON.parse(response) as Response
    if (response.id < 0) throw new Error(`Response is missing id: ${response}`)
    const resolve = this.requests[response.id]
    if (resolve === undefined) throw new Error(`No request found for response with id: ${response.id}`)
    resolve(response)
    delete this.requests[response.id]
  }
}
