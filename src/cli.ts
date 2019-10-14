import {
  defaultHandler,
  getLogger,
  LogLevel,
  replaceHandlers
} from '@stencila/logga'
import minimist from 'minimist'
import { ClientType } from './base/Client'
import Executor from './base/Executor'
import Server from './base/Server'
import discoverStdio from './stdio/discover'
import StdioClient from './stdio/StdioClient'
import HttpServer from './http/HttpServer'
import TcpServer from './tcp/TcpServer'
import WebSocketServer from './ws/WebSocketServer'

const { _: args, ...options } = minimist(process.argv.slice(2))

const log = getLogger('executa:serve')
replaceHandlers(data =>
  defaultHandler(data, {
    level: options.debug !== undefined ? LogLevel.debug : LogLevel.info
  })
)

const main = async () => {
  // Initialize the executor
  const executor = await init()

  // Run command
  const command = args[0]
  if (command === 'serve' || command === undefined) return serve(executor)
  else if (command === 'execute') return execute(executor)
  else {
    log.error(`Unrecognised command: ${command}`)
  }
}

/**
 * Initialize the executor
 */
const init = async () => {
  // Discover other executors registered on this machine
  // In the future this may attempt to discover remote executors as well
  const manifests = await discoverStdio()
  if (manifests.length === 0) {
    log.warn(
      'No peer executors discovered on this machine. Executor will have limited capabilities.'
    )
  }

  // Create a list of client types that can be used by executor
  const clientTypes: ClientType[] = [StdioClient as ClientType]

  return new Executor(manifests, clientTypes)
}

/**
 * Serve the executor
 */
const serve = async (executor: Executor) => {
  // Add server classes based on supplied options
  const servers: Server[] = []
  if (options.tcp !== undefined) {
    servers.push(new TcpServer(executor, options.tcp))
  }
  if (options.http !== undefined) {
    servers.push(new HttpServer(executor, options.http))
  }
  if (options.ws !== undefined) {
    servers.push(new WebSocketServer(executor, options.ws))
  }
  if (servers.length === 0) {
    log.warn(
      'No servers specified in options (e.g. --tcp --stdio). Executor will not be accessible.'
    )
  }
  await executor.start(servers)
}

/**
 * Convert a document
 */
const convert = async (executor: Executor): Promise<void> => {
  const input = args[1]
  const output = args[2] !== undefined ? args[2] : '-'

  const decoded = await executor.decode(input)
  await executor.encode(decoded, output)
}

/**
 * Execute a document
 */
const execute = async (executor: Executor): Promise<void> => {
  const input = args[1]
  const output = args[2] !== undefined ? args[2] : input

  const decoded = await executor.decode(input)
  const executed = await executor.execute(decoded)
  await executor.encode(executed, output)
}

// Run the main function and log any exceptions
main()
  .then(() => {})
  .catch(err => log.error(err))
