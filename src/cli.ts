import { defaultHandler, getLogger, LogLevel, replaceHandlers } from '@stencila/logga';
import fs from 'fs';
import minimist from 'minimist';
import { promisify } from 'util';
import { ClientType } from './base/Client';
import Executor from './base/Executor';
import Server from './base/Server';
import discoverStdio from './stdio/discover';
import StdioClient from './stdio/StdioClient';
import TcpServer from './tcp/TcpServer';

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

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
const serve = (executor: Executor) => {
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
}

/**
 * Convert a document
 */
const convert = async (executor: Executor): Promise<void> => {
  const input = args[1]
  const output = args[2] || '-'

  const content = await readFile(input, 'utf8')

  const decoded = await executor.decode(content)
  const encoded = await executor.encode(decoded)

  if (output === '-') console.log(encoded)
  else await writeFile(output, encoded)
}

/**
 * Execute a document
 */
const execute = async (executor: Executor): Promise<void> => {
  const input = args[1]
  const output = args[2] || input

  const content = await readFile(input, 'utf8')

  const decoded = await executor.decode(content)
  const executed = await executor.execute(decoded)
  const encoded = await executor.encode(executed)

  if (output === '-') console.log(encoded)
  else await writeFile(output, encoded)
}

// Run the main function and log any exceptions
main()
  .then(() => {})
  .catch(err => log.error(err))
