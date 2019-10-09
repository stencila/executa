import {
  defaultHandler,
  getLogger,
  LogLevel,
  replaceHandlers
} from '@stencila/logga'
import minimist from 'minimist'
import Executor from './base/Executor'
import Server from './base/Server'
import discoverStdio from './stdio/discover'
import TcpServer from './tcp/TcpServer'
import StdioClient from './stdio/StdioClient'
import { ClientType } from './base/Client'

const { _, ...options } = minimist(process.argv.slice(2))

const log = getLogger('executa:serve')
replaceHandlers(data =>
  defaultHandler(data, {
    level: options.debug === undefined ? LogLevel.debug : LogLevel.info
  })
)

// Discover other executors registered on this machine
// In the future this may attempt to discover remote executors as well
const manifests = discoverStdio()
if (manifests.length === 0) {
  log.warn(
    'No peer executors discovered on this machine. Executor will have limited capabilities.'
  )
}

// Create a list of client types that can be used by executor
const clientTypes: ClientType[] = [StdioClient as ClientType]

// Create executor that will served by servers
const executor = new Executor(manifests, clientTypes)

// Add server classes based on supplied options
const servers: Server[] = []
if (options.tcp !== undefined) {
  servers.push(new TcpServer(executor, options.tcp))
}
if (servers.length === 0) {
  log.warn(
    'No servers specified in options (e.g. --tcp --stdio). Executor will not be accessible.'
  )
}

executor.start(servers)
