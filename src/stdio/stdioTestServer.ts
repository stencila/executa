/**
 * Used as a test server by `StdioClientServer.test.ts`
 *
 * Run with one of these args to simulate various errors:
 *
 * - `crash-on-start`
 * - `exit-prematurely`
 *
 * Or call the decode method e.g.
 *
 * - `client.decode('crash now!')`
 */

import { StdioServer } from './StdioServer'
import { Worker } from '../base/Worker'
import { Node } from '@stencila/schema'

class TestExecutor extends Worker {
  decode(content: string, format: string): Promise<Node> {
    if (content === 'send bad message') {
      process.stdout.write('Hah hah, a bad message to try to crash you!')
      return Promise.resolve('bad message sent')
    } else if (content === 'crash now!') {
      setTimeout(() => process.exit(1), 100)
      return Promise.resolve('crashing soon')
    } else return super.decode(content, format)
  }
}

const executor = new TestExecutor()
const server = new StdioServer()

const arg = process.argv[2]
if (arg === 'crash-on-start') {
  process.exit(1)
} else if (arg === 'exit-prematurely') {
  setTimeout(() => process.exit(0), 500)
}

server.start(executor).catch(error => {
  throw error
})
