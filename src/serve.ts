/* eslint-disable */

import minimist from 'minimist'
import { getLogger, LogLevel, replaceHandlers } from '@stencila/logga'
import TcpServer from './tcp/TcpServer'
import Executor from './base/Executor'
import { ManifestFacade } from './base/ManifestFacade'

const log = getLogger('engine:serve')

const debug = true

replaceHandlers(data => {
  const { level, tag, message } = data
  if (level <= (debug ? LogLevel.debug : LogLevel.warn)) {
    process.stderr.write(
      `${tag}: ${LogLevel[level].toUpperCase()}: ${message}\n`
    )
  }
})

const { _, ...options } = minimist(process.argv.slice(2))

if (options.tcp !== undefined) {
  const peers = ManifestFacade.getPeers()
  const e = new Executor(peers)
  const server = new TcpServer(e)

  server.start()
  log.info('Listening')
}
