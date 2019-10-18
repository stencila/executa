import { getLogger } from '@stencila/logga'
import net from 'net'
import { VsockAddress } from '../base/Transports'
import StreamClient from '../stream/StreamClient'

const log = getLogger('executa:vsock:client')

export default class VsockFirecrackerClient extends StreamClient {
  private socket: net.Socket

  public constructor(address: VsockAddress = new VsockAddress()) {
    const { path, port } = address
    if (path === undefined) throw new Error(`Path is required`)

    const socket = net.connect(path)
    socket.on('connect', () => {
      log.debug(`${path}:${port}: connecting`)
      socket.write(`CONNECT ${port}\n`)
    })
    socket.on('error', error => {
      log.error(`${path}:${port}: ${error}`)
    })
    socket.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      log.debug(`${path}:${port}: connection-closed`)
    })

    super(socket, socket)
    this.socket = socket
  }

  public stop(): void {
    this.socket.destroy()
  }
}
