import { Socket } from 'net'
import { StreamClient } from '../stream/StreamClient'
import { getLogger } from '@stencila/logga'
import { TcpAddress, TcpAddressInitializer } from '../base/Transports'

const log = getLogger('executa:tcp:client')

export class TcpClient extends StreamClient {
  private socket: Socket

  public constructor(address: TcpAddressInitializer = new TcpAddress()) {
    const tcpAddress = new TcpAddress(address)
    const { host, port } = tcpAddress

    const socket = new Socket()
    socket.connect(port, host, () => {
      log.debug(`Connection open: ${tcpAddress.url()}`)
    })
    socket.on('close', () => {
      log.debug(`Connection closed: ${host}:${port}`)
    })
    super(socket, socket)

    this.socket = socket
  }

  public stop(): Promise<void> {
    this.socket.destroy()
    return Promise.resolve()
  }

  static discover(): TcpClient[] {
    log.warn('No peer discovery available for TCP clients')
    return []
  }
}
