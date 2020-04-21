import { getLogger } from '@stencila/logga'
import net from 'net'
import { VsockAddress } from '../base/Transports'
import { StreamClient } from '../stream/StreamClient'
import { InternalError } from '../base/errors'

const log = getLogger('executa:vsock:client')

export class VsockFirecrackerClient extends StreamClient {
  /**
   * The address of the server to connect to.
   */
  private readonly address: VsockAddress

  /**
   * The socket used for the connection.
   */
  private socket?: net.Socket

  /**
   * Construct a `VsockFirecrackerClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(address: VsockAddress = new VsockAddress()) {
    super('vs')
    this.address = address
  }

  /**
   * @override Override of {@link StreamClient.start} to create
   * a new socket and set up event handling.
   */
  public start(): Promise<void> {
    // Don't do anything if socket is already created
    if (this.socket !== undefined) return Promise.resolve()

    const { path, port } = this.address
    if (path === undefined) throw new InternalError(`Path is required`)

    const socket = (this.socket = net.connect(path))
    socket.on('connect', () => {
      log.debug(`${path}:${port}: connecting`)
      socket.write(`CONNECT ${port}\n`)
    })
    socket.on('error', (error) => {
      log.error(`${path}:${port}: ${error}`)
    })
    socket.on('close', () => {
      // If there is no server listening in the VM then the connection will be closed.
      log.debug(`${path}:${port}: connection-closed`)
    })
    return super.start(socket, socket)
  }

  /**
   * @override Override of {@link Executor.stop} to
   * destroy the socket.
   */
  public stop(): Promise<void> {
    if (this.socket !== undefined) this.socket.destroy()
    return Promise.resolve()
  }
}
