import {spawn, ChildProcess} from 'child_process'
import StreamClient from "../stream/StreamClient";

export default class StdioClient extends StreamClient {

  process: ChildProcess

  constructor (command: string) {
    const process = spawn(command, {shell: true})
    if (!process) throw new Error('Spawning python3 failed')

    const {stdin, stdout, stderr} = process
    if (
      stdout === null ||
      stdin === null ||
      stderr === null
    )
      throw new Error('STDIO is not set up right')

    super(stdin, stdout)
    this.process = process
  }
}
