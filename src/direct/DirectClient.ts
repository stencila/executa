import { getLogger } from '@stencila/logga'
import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { DirectAddress } from '../base/Transports'
import { DirectServer } from './DirectServer'

const log = getLogger('executa:direct:client')

export class DirectClient extends Client {
  private server: DirectServer

  public constructor(address: Pick<DirectAddress, 'server'>) {
    super()
    this.server = address.server
    this.server.client = this
  }

  protected send(request: JsonRpcRequest): void {
    this.server
      // @ts-ignore server.receive is private
      .receive(request)
      .then(response => {
        if (response !== undefined) this.receive(response)
      })
      .catch(error => {
        throw error
      })
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
