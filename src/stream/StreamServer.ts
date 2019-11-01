// @ts-ignore
import * as lps from 'length-prefixed-stream'
import { Readable, Writable } from 'stream'
import { Executor } from '../base/Executor'
import { Server } from '../base/Server'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
export abstract class StreamServer extends Server {
  /**
   * Encoder to send length prefixed messages over outgoing stream.
   */
  protected encoder: lps.Encoder

  public async start(
    executor?: Executor,
    incoming: Readable = process.stdin,
    outgoing: Writable = process.stdout
  ): Promise<void> {
    await super.start(executor)

    const decoder = lps.decode()
    incoming.pipe(decoder)
    decoder.on('data', async (data: Buffer) => {
      const json = data.toString()
      const response = await this.receive(json)
      if (response !== undefined) this.send(response)
    })

    this.encoder = lps.encode()
    this.encoder.pipe(outgoing)
  }

  public send(data: string | JsonRpcResponse | JsonRpcRequest): void {
    if (typeof data !== 'string') data = JSON.stringify(data)
    this.encoder.write(data)
  }
}
