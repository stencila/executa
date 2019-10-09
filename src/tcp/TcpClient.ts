import { Socket } from 'net'
import StreamClient from '../stream/StreamClient'
import { getLogger } from '@stencila/logga'
import { TcpAddress, tcpAddress } from '../base/Transports'

const log = getLogger('executa:tcp:client')

export default class TcpClient extends StreamClient {
  private socket: Socket

  public constructor(address?: string | Omit<TcpAddress, 'type'>) {
    const { host, port } = tcpAddress(address, {
      host: '127.0.0.1',
      port: 2000
    })

    const socket = new Socket()

    socket.connect(port, host, () => {
      log.debug(`Connection open: ${host}:${port}`)
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
