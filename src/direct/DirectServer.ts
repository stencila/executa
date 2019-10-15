import Server from '../base/Server'
import { DirectAddress, Transport } from '../base/Transports'

export default class DirectServer extends Server {
  public get address(): DirectAddress {
    return {
      type: Transport.direct,
      server: this
    }
  }
}
