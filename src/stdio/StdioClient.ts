import { spawn, ChildProcess } from 'child_process'
import StreamClient from '../stream/StreamClient'
import { StdioAddress } from '../base/Transports'

export default class StdioClient extends StreamClient {
  private process: ChildProcess

  public constructor(address: string | Omit<StdioAddress, 'type'>) {
    let command
    let args: string[] = []
    if (typeof address === 'string') {
      const parts = address.split(/\s/)
      command = parts[0]
      args = parts.slice(1)
    } else {
      command = address.command
      if (address.args !== undefined) args = address.args
    }

    const process = spawn(command, args)
    const { stdin, stdout, stderr } = process
    if (stdout === null || stdin === null || stderr === null)
      throw new Error('STDIO is not set up right')

    super(stdin, stdout)
    this.process = process
  }
}
