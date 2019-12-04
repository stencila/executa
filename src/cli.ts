#!/usr/bin/env node

import { collectOptions, helpUsage } from '@stencila/configa/dist/run';
import { defaultHandler, LogLevel, replaceHandlers } from '@stencila/logga';
import { CodeChunk } from '@stencila/schema';
import * as readline from 'readline';
import { ClientType, addressesToClients } from './base/Client';
import { Delegator } from './base/Delegator';
import { Executor } from './base/Executor';
import { Manager } from './base/Manager';
import { Queuer } from './base/Queuer';
import { Server } from './base/Server';
import { VsockAddress } from './base/Transports';
import { Config } from './config';
import configSchema from './config.schema.json';
import { HttpServer } from './http/HttpServer';
import { StdioServer } from './stdio/StdioServer';
import { TcpServer } from './tcp/TcpServer';
import { VsockServer } from './vsock/VsockServer';
import { WebSocketServer } from './ws/WebSocketServer';
import { HttpClient } from './http/HttpClient';
import { StdioClient } from './stdio/StdioClient';
import { WebSocketClient } from './ws/WebSocketClient';
import { TcpClient } from './tcp/TcpClient';
import chalk from 'chalk'
import ora, { Ora } from 'ora'

const main = async (): Promise<void> => {
  // Collect configuration options
  const { args = ['help'], config, valid, log } = collectOptions<Config>(
    'executa',
    configSchema
  )

  // Configure log handler
  const { debug } = config
  replaceHandlers(data =>
    defaultHandler(data, {
      maxLevel: debug ? LogLevel.debug : LogLevel.info,
      showStack: debug
    })
  )

  // Run the command
  const command = args[0]
  switch (command) {
    case 'help':
      return help(args[1])
    case 'conf':
      return conf(config)
    default: {
      if (!valid) process.exit(1)
      const executor = init(config)
      switch (command) {
        case 'repl':
          return repl(executor, args[1], debug)
        case 'start':
        case 'serve':
          return start(executor)
        case 'convert':
          return convert(executor)
        case 'execute':
          return execute(executor)
      }
    }
  }
  log.error(`Unknown command: ${command}`)
}

/**
 * Show usage help, possibly for a single option
 */
const help = (option?: string): void =>
  console.log(helpUsage(configSchema, option))

/**
 * Show the configuration
 */
const conf = (config: Config): void =>
  console.log(JSON.stringify(config, null, '  '))

/**
 * Initialize a root executor based on the config
 */
const init = (config: Config): Executor => {
  // Configure log handler
  const { debug } = config
  replaceHandlers(data =>
    defaultHandler(data, {
      maxLevel: debug ? LogLevel.debug : LogLevel.info,
      showStack: debug
    })
  )

  // Create servers based on config options
  const { stdio, vsock, tcp, http, ws } = config
  const servers: Server[] = []
  if (stdio)
    servers.push(new StdioServer())
  if (vsock !== false)
    servers.push(new VsockServer(new VsockAddress(vsock === true ? undefined : vsock)))
  if (tcp !== false) servers.push(new TcpServer(tcp === true ? undefined : tcp))
  if (http !== false) servers.push(new HttpServer(http === true ? undefined : http))
  if (ws !== false) servers.push(new WebSocketServer(ws === true ? undefined : ws))

  // Client types that are available for connecting to peers
  const clientTypes: ClientType[] = [
    StdioClient,
    TcpClient,
    HttpClient,
    WebSocketClient
  ]

  // Configure the delegator with clients for each peer
  const { peers } = config
  const executors: Executor[] = addressesToClients(peers, clientTypes)
  const delegator = new Delegator(executors, clientTypes)

  // Configure the queue
  const queuer = new Queuer(config)

  return new Manager(servers, delegator, queuer)
}

/**
 * A simple REPL for testing connection to, and configuration of,
 * executors.
 *
 * Sends requests to execute a `CodeChunk` with `programmingLanguage: 'sh'`
 * to the VM and prints it's `outputs` to the console. You can change the
 * language being used by typing a line starting with `<` e.g. `< py`
 */
const repl = (executor: Executor, lang = 'python', debug: boolean): void => {
  // Reconfigure log handler to only show `info` and `debug` events
  // and error stacks when `--debug` option is set
  replaceHandlers(data =>
    defaultHandler(data, {
      maxLevel: debug ? LogLevel.debug : LogLevel.warn,
      showStack: debug
    })
  )

  // Function to create a prompt base don current
  // language
  const prompt = (): string => `${chalk.green(lang)} ${chalk.grey('> ')}`

  // Create the REPL with the starting prompt
  const repl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: prompt()
  })
  repl.prompt()

  // Function that handles each line
  const getLine = async (line: string): Promise<void> => {
    // Check if user wants to switch language
    const match = /^<\s*(\w+)/.exec(line)
    if (match !== null) {
      // Change language and provide new prompt
      lang = match[1].toLowerCase()
      repl.setPrompt(prompt())
      repl.prompt()
      return
    }

    // User entered a 'normal' line: execute a `CodeChunk`..

    // Spinner: it's useful feedback for long cells
    const spinnerText = (seconds = 0) => chalk.grey(`${seconds}s`)
    const spinner = ora({
      text: spinnerText(),
      color: 'gray',
      // With this set to true, all input is ignored while
      // the spinner is running and it affects subsequent
      // lines. Instead, we implement out own muting of stdin
      // while command is running.
      discardStdin: false
    }).start()
    const started = Date.now()
    const interval = setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000)
      spinner.text = spinnerText(seconds)
      spinner.color = ['gray', 'blue', 'cyan', 'green', 'yellow', 'magenta', 'red'][Math.min(seconds, 6)] as Ora['color']
    }, 1000)

    const result = (await executor.execute({
      type: 'CodeChunk',
      programmingLanguage: lang,
      text: line
    })) as CodeChunk

    // Stop the spinner
    clearInterval(interval)
    spinner.stop()

    // Display any errors
    if (result.errors !== undefined && result.errors.length > 0) {
      for (const error of result.errors)
        if (error.message !== undefined) console.error(`${chalk.red(error.message)}`)
    }

    // Display any outputs
    if (result.outputs !== undefined && result.outputs.length > 0) {
      for (const output of result.outputs) console.log(`${chalk.blue(output)}`)
    }

    // Provide a new prompt
    repl.prompt()
  }

  // For each line the user enters...
  repl.on('line', line => {
    getLine(line).catch(e => {
      console.warn(e)
    })
  })
}

/**
 * Start the executor
 */
const start = (executor: Executor): Promise<void> => executor.start()

/**
 * Convert a document
 */
const convert = async (executor: Executor): Promise<void> => {
  const input = 'TODO:' // args[1]
  const output = 'TODO:' // args[2] !== undefined ? args[2] : '-'

  const decoded = await executor.decode(input)
  await executor.encode(decoded, output)
}

/**
 * Execute a document
 */
const execute = async (executor: Executor): Promise<void> => {
  const input = 'TODO:' // args[1]
  const output = 'TODO:' // args[2] !== undefined ? args[2] : input

  const decoded = await executor.decode(input)
  const executed = await executor.execute(decoded)
  await executor.encode(executed, output)
}

// Run the main function and log any exceptions
main().catch(err => console.error(err))
