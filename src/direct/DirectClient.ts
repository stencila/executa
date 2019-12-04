import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { DirectAddress } from '../base/Transports'
import { DirectServer } from './DirectServer'

export class DirectClient extends Client {
  private server: DirectServer

  public constructor(address: Omit<DirectAddress, 'type'>) {
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

  static discover(): DirectClient[] {
    return []
  }
}
