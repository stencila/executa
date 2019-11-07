// @ts-ignore
import * as lps from 'length-prefixed-stream'
import { Readable, Writable } from 'stream'
import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'

export class StreamClient extends Client {
  /**
   * Encoder to send length prefixed messages over outgoing stream.
   */
  private encoder: lps.Encoder

  /**
   * Create an instance of `StreamClient`.
   *
   * @param {Writable} outgoing Outgoing stream to send JSON-RPC requests on.
   * @param {Readable} incoming Incoming stream to receive JSON-RPC responses on.
   */
  public constructor(outgoing: Writable, incoming: Readable) {
    super()

    // Do not keep reference to streams since they
    // are provided to this constructor, so probably
    // don't want to destroy them in this class

    this.encoder = lps.encode()
    this.encoder.pipe(outgoing)

    const decoder = lps.decode()
    incoming.pipe(decoder)
    decoder.on('data', (data: Buffer) => {
      const json = data.toString()
      this.receive(json)
    })
  }

  protected send(request: JsonRpcRequest): void {
    this.encoder.write(JSON.stringify(request) + '\n')
  }
}
