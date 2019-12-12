import lps from 'length-prefixed-stream'
import { Readable, Writable } from 'stream'
import { Client } from '../base/Client'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:stream:client')

export class StreamClient extends Client {
  /**
   * Encoder to send length prefixed messages to outgoing stream.
   */
  private encoder?: lps.Encoder

  /**
   * Construct a `StreamClient`.
   *
   * @param family The two letter prefix for the id of this client
   */
  public constructor(family = 'st') {
    super(family)
  }

  /**
   * Create an instance of `StreamClient`.
   *
   * @param {Writable} outgoing Outgoing stream to send JSON-RPC requests on.
   * @param {Readable} incoming Incoming stream to receive JSON-RPC responses on.
   */
  public start(outgoing?: Writable, incoming?: Readable): Promise<void> {
    // Do not keep reference to streams since they
    // are provided to this constructor, so probably
    // don't want to destroy them in this class
    //
    // These streams can be undefined (e.g. if a `StdioClient span fails)
    // so check for that here
    if (outgoing === undefined || incoming === undefined) {
      log.error('One or more streams are undefined')
      return Promise.resolve()
    }

    // Set up encoder and decoder
    const encoder = (this.encoder = lps.encode())
    encoder.pipe(outgoing)

    const decoder = lps.decode()
    decoder.on('data', (data: Buffer) => {
      const json = data.toString()
      this.receive(json)
    })
    incoming.pipe(decoder)

    return Promise.resolve()
  }

  /**
   * @implements Implements {@link Client.send} to start the
   * client if necessary and write the request to the encoder.
   */
  protected async send(request: JsonRpcRequest): Promise<void> {
    if (this.encoder === undefined) await this.start()
    if (this.encoder !== undefined)
      this.encoder.write(JSON.stringify(request) + '\n')
  }
}
