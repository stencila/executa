import { spawn, ChildProcess } from 'child_process'
import StreamClient from '../stream/StreamClient'

export default class StdioClient extends StreamClient {
  private process: ChildProcess

  public constructor(
    command: string,
    args: string[],
    options: object = { shell: true }
  ) {
    const process = spawn(command, args, options)
    const { stdin, stdout, stderr } = process
    if (stdout === null || stdin === null || stderr === null)
      throw new Error('STDIO is not set up right')

    super(stdin, stdout)
    this.process = process
  }
}
