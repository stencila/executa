import { Socket } from 'net'
import StreamClient from '../stream/StreamClient'
import { getLogger } from '@stencila/logga'
import { TcpAddressInitializer, TcpAddress } from '../base/Transports'

const log = getLogger('executa:tcp:client')

export default class TcpClient extends StreamClient {
  private address: TcpAddress

  private socket: Socket

  public constructor(address: TcpAddressInitializer) {
    const address_ = new TcpAddress(address)
    const { host, port } = address_

    const socket = new Socket()
    socket.connect(port, host, () => {
      log.debug(`Connection open: ${this.address.toString()}`)
    })
    socket.on('close', () => {
      log.debug(`Connection closed: ${host}:${port}`)
    })
    super(socket, socket)

    this.address = address_
    this.socket = socket
  }

  public stop() {
    this.socket.destroy()
  }
}
