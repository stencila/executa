import lps from 'length-prefixed-stream'
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

    this.encoder = lps.encode()
    const decoder = lps.decode()
    decoder.on('data', (data: Buffer) => {
      const json = data.toString()
      this.receive(json)
    })

    // Do not keep reference to streams since they
    // are provided to this constructor, so probably
    // don't want to destroy them in this class
    //
    // Although these streams are required parameters
    // they can be undefined (e.g. if a `StdioClient span fails)
    // so check for that here
    if (outgoing !== undefined) this.encoder.pipe(outgoing)
    if (incoming !== undefined) incoming.pipe(decoder)
  }

  protected send(request: JsonRpcRequest): void {
    this.encoder.write(JSON.stringify(request) + '\n')
  }
}
