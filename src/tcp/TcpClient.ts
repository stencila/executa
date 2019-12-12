import { Socket } from 'net'
import { StreamClient } from '../stream/StreamClient'
import { getLogger } from '@stencila/logga'
import { TcpAddress, TcpAddressInitializer } from '../base/Transports'

const log = getLogger('executa:tcp:client')

export class TcpClient extends StreamClient {
  /**
   * The address of the server to connect to.
   */
  public readonly address: TcpAddress

  /**
   * The socket used for the connection.
   */
  private socket?: Socket

  /**
   * Construct a `TcpClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(address: TcpAddressInitializer = new TcpAddress()) {
    super('tcp')
    this.address = new TcpAddress(address)
  }

  /**
   * @override Override of {@link StreamClient.start} to create
   * a new socket and set up event handling.
   */
  public start(): Promise<void> {
    // Don't do anything if socket is already created
    if (this.socket !== undefined) return Promise.resolve()

    const { host, port } = this.address
    const url = this.address.url()

    const socket = (this.socket = new Socket())
    socket.connect(port, host, () => {
      log.debug(`Connection open: ${url}`)
    })
    socket.on('close', () => {
      log.debug(`Connection closed: ${url}`)
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

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Not implemented yet. In the future
   * could be implemented using port scanning on the
   * localhost.
   */
  static discover(): Promise<TcpClient[]> {
    log.warn('Discovery not available for TCP client')
    return Promise.resolve([])
  }
}
