/**
 * Used as a test server by `StdioClientServer.test.ts`
 *
 * Call with one of these args to simulate various errors:
 *
 * - `crash-on-start`
 * - `exit-prematurely`
 * - `crash-on-request`
 */

import StdioServer from './StdioServer'

const server = new StdioServer()

const arg = process.argv[2]
if (arg === 'crash-on-start') {
  process.exit(1)
} else if (arg === 'exit-prematurely') {
  setTimeout(() => process.exit(0), 500)
} else if (arg === 'crash-on-request') {
  // Mess with the server's executor so that when a request comes in it fails.
  // @ts-ignore that executor is private
  server.executor = {
    decode: () => process.exit(1)
  }
}

server.run().catch(error => {
  throw error
})
