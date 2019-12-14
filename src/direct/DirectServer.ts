import { Server } from '../base/Server'
import { Addresses, DirectAddress, Transport } from '../base/Transports'
import { Client } from '../base/Client'
import { InternalError } from '../base/errors'
import { JsonRpcRequest } from '../base/JsonRpcRequest'

export class DirectServer extends Server {
  client?: Client

  /**
   * @implements Implements {@link Server.addresses}.
   */
  public addresses(): Promise<Addresses> {
    return Promise.resolve({
      [Transport.direct]: new DirectAddress({ server: this })
    })
  }

  public notify(subject: string, message: string): void {
    if (this.client === undefined)
      throw new InternalError('No client connected!')
    const notification = new JsonRpcRequest(subject, { message }, false)
    // @ts-ignore client.receive is private
    this.client.receive(notification)
  }
}
