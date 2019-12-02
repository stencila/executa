#!/usr/bin/env node

import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga'
import { Manager } from './base/Manager'
import { ClientType } from './base/Client'
import { Server } from './base/Server'
import { VsockAddress } from './base/Transports'
import { HttpServer } from './http/HttpServer'
import { discover as discoverStdio } from './stdio/discover'
import { StdioClient } from './stdio/StdioClient'
import { StdioServer } from './stdio/StdioServer'
import { TcpServer } from './tcp/TcpServer'
import { VsockServer } from './vsock/VsockServer'
import { WebSocketServer } from './ws/WebSocketServer'

import { collectOptions, helpUsage } from '@stencila/configa/dist/run'
import { Config } from './config'
import configSchema from './config.schema.json'

const { args = ['help'], config, valid, log } = collectOptions<Config>(
  'executa',
  configSchema
)
const command = args[0]

const { debug, stdio, vsock, tcp, http, ws } = config

replaceHandlers(data =>
  defaultHandler(data, {
    maxLevel: debug ? LogLevel.debug : LogLevel.info,
    showStack: debug
  })
)

const main = async () => {
  // Add server classes based on supplied options
  const servers: Server[] = []
  if (stdio) {
    servers.push(new StdioServer())
  }
  if (vsock !== false)
    servers.push(
      new VsockServer(new VsockAddress(vsock === true ? 6000 : vsock))
    )
  if (tcp !== false) servers.push(new TcpServer(tcp === true ? 7000 : tcp))
  if (http !== false) servers.push(new HttpServer(http === true ? 8000 : http))
  if (ws !== false) servers.push(new WebSocketServer(ws === true ? 9000 : ws))

  // Initialize the executor
  const manager = new Manager(
    [discoverStdio],
    [StdioClient as ClientType],
    servers
  )

  // Run command
  switch (command) {
    case 'help':
      return console.log(helpUsage(configSchema, args[1]))
    case 'config':
      return console.log(JSON.stringify(config, null, '  '))
    case 'serve':
      return manager.start()
    case 'execute':
      return execute(manager)
    default:
      log.error(`Unknown command: ${command}`)
  }
}

/**
 * Convert a document
 */
const convert = async (executor: Manager): Promise<void> => {
  const input = args[1]
  const output = args[2] !== undefined ? args[2] : '-'

  const decoded = await executor.decode(input)
  await executor.encode(decoded, output)
}

/**
 * Execute a document
 */
const execute = async (executor: Manager): Promise<void> => {
  const input = args[1]
  const output = args[2] !== undefined ? args[2] : input

  const decoded = await executor.decode(input)
  const executed = await executor.execute(decoded)
  await executor.encode(executed, output)
}

// Run the main function and log any exceptions
if (valid)
  main()
    .then(() => {})
    .catch(err => log.error(err))
