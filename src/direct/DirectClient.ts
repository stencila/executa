import Client from '../base/Client'
import Request from '../base/Request'
import Server from '../base/Server'
import { DirectAddress } from '../base/Transports'

export default class DirectClient extends Client {
  private server: Server

  public constructor(address: Omit<DirectAddress, 'type'>) {
    super()
    this.server = address.server
  }

  protected send(request: Request): void {
    // @ts-ignore server.receive is private
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.server.receive(request).then(response => this.receive(response))
  }
}
