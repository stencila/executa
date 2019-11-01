import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { Server } from '../base/Server'
import { DirectAddress } from '../base/Transports'

export class DirectClient extends Client {
  private server: Server

  public constructor(address: Omit<DirectAddress, 'type'>) {
    super()
    this.server = address.server
  }

  protected send(request: JsonRpcRequest): void {
    // @ts-ignore server.receive is private
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.server.receive(request).then(response => {
      if (response !== undefined) this.receive(response)
    })
  }
}
