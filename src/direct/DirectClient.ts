import { getLogger } from '@stencila/logga'
import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { DirectAddress, DirectAddressInitializer } from '../base/Transports'
import { DirectServer } from './DirectServer'

const log = getLogger('executa:direct:client')

export class DirectClient extends Client {
  /**
   * The server to connect to
   */
  private server: DirectServer

  /**
   * Construct a `DirectClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(address: DirectAddressInitializer | DirectServer) {
    super('di')
    this.server = address instanceof DirectServer ? address : address.server
    this.server.client = this
  }

  /**
   * @implements Implements {@link Client.send} by sending
   * the request directly to the server.
   */
  protected async send(request: JsonRpcRequest): Promise<void> {
    // @ts-ignore server.receive is protected
    const response = await this.server.receive(request)
    if (response !== undefined) this.receive(response)
  }

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Discovery is not possible for direct
   * servers, so logs a warning and returns an empty array.
   */
  static discover(): Promise<DirectClient[]> {
    log.warn('Discovery not available for direct client')
    return Promise.resolve([])
  }
}
