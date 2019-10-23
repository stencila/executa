import { StreamServer } from '../stream/StreamServer'
import { StdioAddress, Transport } from '../base/Transports'

export class StdioServer extends StreamServer {
  public get address(): StdioAddress {
    return {
      type: Transport.stdio,
      command: process.argv[0],
      args: process.argv.slice(1)
    }
  }
}
