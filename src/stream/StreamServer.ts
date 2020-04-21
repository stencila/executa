import { getLogger } from '@stencila/logga'
import lps from 'length-prefixed-stream'
import { Readable, Writable } from 'stream'
import { Executor } from '../base/Executor'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { Server } from '../base/Server'

const log = getLogger('executa:stream:server')
export abstract class StreamServer extends Server {
  /**
   * Encoder to send length prefixed messages over outgoing stream.
   */
  protected encoder: lps.Encoder

  constructor() {
    super()
    this.encoder = lps.encode()
  }

  public async start(
    executor: Executor,
    incoming: Readable = process.stdin,
    outgoing: Writable = process.stdout
  ): Promise<void> {
    await super.start(executor)

    const decoder = lps.decode()
    incoming.pipe(decoder)
    decoder.on('data', (data: Buffer) => {
      const json = data.toString()
      this.receive(json)
        .then((response) => {
          if (response !== undefined) this.send(response)
        })
        .catch((error) => log.error(error))
    })

    this.encoder.pipe(outgoing)
  }

  public send(data: string | JsonRpcResponse | JsonRpcRequest): void {
    if (typeof data !== 'string') data = JSON.stringify(data)
    this.encoder.write(data)
  }

  public notify(subject: string, message: string): void {
    const notification = new JsonRpcRequest(subject, { message }, false)
    this.send(notification)
  }
}
