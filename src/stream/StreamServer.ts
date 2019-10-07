import { Readable, Writable } from 'stream'
// @ts-ignore
import * as lps from 'length-prefixed-stream'
import Server from '../base/Server'
import Executor from '../base/Executor'

export default class StreamServer extends Server {
  /**
   * Encoder to send length prefixed messages over outgoing stream.
   */
  encoder: lps.Encoder

  constructor(executor?: Executor) {
    super(executor)
  }

  // Implementation of `Server` methods

  start(
    incoming: Readable = process.stdin,
    outgoing: Writable = process.stdout
  ) {
    const decoder = lps.decode()
    incoming.pipe(decoder)
    decoder.on('data', async (data: Buffer) => {
      const json = data.toString()
      const response = await this.receive(json)
      this.encoder.write(response)
    })

    this.encoder = lps.encode()
    this.encoder.pipe(outgoing)
  }

  stop() {}
}
