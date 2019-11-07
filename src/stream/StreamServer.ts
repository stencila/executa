// @ts-ignore
import * as lps from 'length-prefixed-stream'
import { Readable, Writable } from 'stream'
import { Executor } from '../base/Executor'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { JsonRpcResponse } from '../base/JsonRpcResponse'
import { Server } from '../base/Server'
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

  public notify(subject: string, message: string): void {
    const notification = new JsonRpcRequest(subject, { message }, false)
    this.send(notification)
  }
}
