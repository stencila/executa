import Server from '../base/Server'
import { DirectAddress, Transport } from '../base/Transports'

export default class DirectServer extends Server {
  public address(): DirectAddress {
    return {
      type: Transport.direct,
      server: this
    }
  }
}
