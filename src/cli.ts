#!/usr/bin/env node

import {
  defaultHandler,
  getLogger,
  LogLevel,
  replaceHandlers
} from '@stencila/logga'
import minimist from 'minimist'
import { BaseExecutor } from './base/BaseExecutor'
import { ClientType } from './base/Client'
import { Server } from './base/Server'
import {
  HttpAddress,
  TcpAddress,
  VsockAddress,
  WebSocketAddress
} from './base/Transports'
import { HttpServer } from './http/HttpServer'
import { discover as discoverStdio } from './stdio/discover'
import { StdioClient } from './stdio/StdioClient'
import { StdioServer } from './stdio/StdioServer'
import { TcpServer } from './tcp/TcpServer'
import { VsockServer } from './vsock/VsockServer'
import { WebSocketServer } from './ws/WebSocketServer'

const { _: args, ...options } = minimist(process.argv.slice(2))

const log = getLogger('executa:cli')

replaceHandlers(data =>
  defaultHandler(data, {
    maxLevel: options.debug !== undefined ? LogLevel.debug : LogLevel.info
  })
)

const main = async () => {
  // Initialize the executor

  // Add server classes based on supplied options
  const servers: Server[] = []
  if (options.stdio !== undefined) {
    servers.push(new StdioServer())
  }
  if (options.vsock !== undefined) {
    servers.push(
      new VsockServer(
        new VsockAddress(
          typeof options.vsock === 'boolean' ? 6000 : options.vsock
        )
      )
    )
  }
  if (options.tcp !== undefined) {
    servers.push(
      new TcpServer(
        new TcpAddress(typeof options.tcp === 'boolean' ? 7000 : options.tcp)
      )
    )
  }
  if (options.http !== undefined) {
    servers.push(
      new HttpServer(
        new HttpAddress(typeof options.http === 'boolean' ? 8000 : options.http)
      )
    )
  }
  if (options.ws !== undefined) {
    servers.push(
      new WebSocketServer(
        new WebSocketAddress(
          typeof options.ws === 'boolean' ? 9000 : options.ws
        )
      )
    )
  }

  const executor = new BaseExecutor(
    [discoverStdio],
    [StdioClient as ClientType],
    servers
  )

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
const serve = async (executor: BaseExecutor) => {
  await executor.start()
}

/**
 * Convert a document
 */
const convert = async (executor: BaseExecutor): Promise<void> => {
  const input = args[1]
  const output = args[2] !== undefined ? args[2] : '-'

  const decoded = await executor.decode(input)
  await executor.encode(decoded, output)
}

/**
 * Execute a document
 */
const execute = async (executor: BaseExecutor): Promise<void> => {
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
