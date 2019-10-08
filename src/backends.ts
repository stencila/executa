/* eslint-disable */
import * as childProcess from 'child_process'
import { getLogger } from '@stencila/logga'
const lps = require('length-prefixed-stream')
const { spawn } = require('child_process')
const log = getLogger('engine:backends')

export interface ExecutorBackend {
  setup(): void

  execute(o: any): Promise<any>
}

abstract class StdioBackend implements ExecutorBackend {
  private process?: childProcess.ChildProcess

  private stdin: any

  private executionRequests: { [key: number]: any } = {}

  private executionRequestCount: number = 0

  protected abstract spawn(): childProcess.ChildProcess

  public setup(): void {
    this.process = this.spawn()
    if (
      this.process.stdout === null ||
      this.process.stdin === null ||
      this.process.stderr === null
    )
      throw new Error('STDIO is not set up right')

    this.process.stderr.on('data', (data: Buffer) => {
      log.error(data.toString())
      process.exit(1)
    })

    const decoder = lps.decode()
    this.process.stdout.pipe(decoder)
    decoder.on('data', (response: Buffer) => this.receive(response))

    this.stdin = lps.encode()
    this.stdin.pipe(this.process.stdin)
  }

  private receive(json: Buffer, raw: boolean = false) {
    const response = JSON.parse(json.toString())
    const resolve = this.executionRequests[response.id]
    resolve(response.body)
    delete this.executionRequests[response.id]
  }

  public async execute(o: any): Promise<any> {
    if (this.process === undefined) {
      throw new Error('Can not execute before setup')
    }

    const id = ++this.executionRequestCount

    const req = {
      id,
      body: o
    }

    const promise = new Promise<any>((resolve, reject) => {
      this.executionRequests[id] = (response: any) => {
        resolve(response)
      }
    })

    this.stdin.write(JSON.stringify(req))

    return promise
  }
}

export class StencilaPythonBackend extends StdioBackend {
  protected spawn() {
    return spawn('python3', ['-m', 'stencila.schema', 'listen'])
  }
}

export class StencilaJsBackend extends StdioBackend {
  protected spawn() {
    return spawn(
      'npx',
      [
        'ts-node',
        '/Users/ben/Documents/stencila/schema/ts/interpreter',
        'listen'
      ],
      {
        cwd: '/Users/ben/Documents/stencila/schema'
      }
    )
  }
}
