import {
  defaultHandler,
  getLogger,
  LogLevel,
  replaceHandlers
} from '@stencila/logga'
import minimist from 'minimist'
import { ClientType } from './base/Client'
import { Executor } from './base/Executor'
import Server from './base/Server'
import discoverStdio from './stdio/discover'
import StdioClient from './stdio/StdioClient'
import HttpServer from './http/HttpServer'
import TcpServer from './tcp/TcpServer'
import WebSocketServer from './ws/WebSocketServer'
import { HttpAddress, TcpAddress, WebSocketAddress } from './base/Transports'

const { _: args, ...options } = minimist(process.argv.slice(2))

const log = getLogger('executa:serve')
replaceHandlers(data =>
  defaultHandler(data, {
    level: options.debug !== undefined ? LogLevel.debug : LogLevel.info
  })
)

const main = async () => {
  // Initialize the executor
  const executor = new Executor([discoverStdio], [StdioClient as ClientType])

  // Run command
  const command = args[0]
  if (command === 'serve' || command === undefined) return serve(executor)
  else if (command === 'execute') return execute(executor)
  else {
    log.error(`Unrecognised command: ${command}`)
  }
}

/**
 * Serve the executor
 */
const serve = async (executor: Executor) => {
  // Add server classes based on supplied options
  const servers: Server[] = []
  if (options.tcp !== undefined) {
    const address = new TcpAddress(
      typeof options.tcp === 'boolean' ? undefined : options.tcp
    )
    servers.push(new TcpServer(executor, address))
  }
  if (options.http !== undefined) {
    const address = new HttpAddress(
      typeof options.http === 'boolean' ? undefined : options.http
    )
    servers.push(new HttpServer(executor, address))
  }
  if (options.ws !== undefined) {
    const address = new WebSocketAddress(
      typeof options.ws === 'boolean' ? undefined : options.ws
    )
    servers.push(new WebSocketServer(executor, address))
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
