// Used as a test server by `StdioClientServer.test.ts`

import StdioServer from './StdioServer'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  const server = new StdioServer()
  await server.run()
})()
