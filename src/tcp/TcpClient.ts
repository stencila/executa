import { Socket } from 'net'
import StreamClient from '../stream/StreamClient'
import { getLogger } from '@stencila/logga'
import { TcpAddressInitializer, TcpAddress } from '../base/Transports'

const log = getLogger('executa:tcp:client')

export default class TcpClient extends StreamClient {
  private socket: Socket

  public constructor(address: TcpAddress = new TcpAddress()) {
    const socket = new Socket()
    const { host, port } = address
    socket.connect(port, host, () => {
      log.debug(`Connection open: ${address.toString()}`)
    })
    socket.on('close', () => {
      log.debug(`Connection closed: ${host}:${port}`)
    })
    super(socket, socket)

    this.socket = socket
  }

  public stop() {
    this.socket.destroy()
  }
}
