import {Readable, Writable} from 'stream'
// @ts-ignore
import * as lps from 'length-prefixed-stream'
import Client from '../base/Client';
import Request from '../base/Request';

export default class StreamClient extends Client {

  /**
   * Encoder to send length prefixed messages over outgoing stream.
   */
  encoder: lps.Encoder

  /**
   * Create an instance of StreamClient.
   *
   * @param {Writable} outgoing Outgoing stream to send JSON-RPC requests on.
   * @param {Readable} incoming Incoming stream to receive JSON-RPC responses on.
   */
  constructor (outgoing: Writable, incoming: Readable) {
    super()

    this.encoder = lps.encode()
    this.encoder.pipe(outgoing)

    const decoder = lps.decode()
    incoming.pipe(decoder)
    decoder.on('data', (data: Buffer) => {
      const json = data.toString()
      this.receive(json)
    })
  }

  // Implementation of `Client` methods

  send (request: Request) {
    this.encoder.write(JSON.stringify(request) + '\n')
  }
}
