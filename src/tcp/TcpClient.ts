import {Socket} from 'net'
import StreamClient from "../stream/StreamClient"
import { getLogger } from '@stencila/logga';

const log = getLogger('executa:tcp:client')

export default class TcpClient extends StreamClient {
  constructor (port: number = 7300, host: string = '127.0.0.1') {
    var socket = new Socket()

    socket.connect(port, host, () => {
      log.debug(`Connection open: ${host}:${port}`)
    })

    socket.on('close', () => {
      log.debug(`Connection closed: ${host}:${port}`)
    })

    super(socket, socket)
  }
}
