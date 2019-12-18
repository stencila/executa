#!/usr/bin/env node

import { collectConfig, helpUsage } from '@stencila/configa/dist/run'
import {
  defaultHandler,
  Logger,
  LogLevel,
  replaceHandlers
} from '@stencila/logga'
import * as schema from '@stencila/schema'
import chalk from 'chalk'
import ora, { Ora } from 'ora'
import * as readline from 'readline'
import { addressesToClients, Client, ClientType } from '../base/Client'
import { Delegator } from '../base/Delegator'
import { Executor } from '../base/Executor'
import { Listener } from '../base/Listener'
import { Manager } from '../base/Manager'
import { Queuer } from '../base/Queuer'
import { Server } from '../base/Server'
import { VsockAddress } from '../base/Transports'
import { Worker } from '../base/Worker'
import { Config } from '../config'
import configSchema from '../config.schema.json'
import { DirectClient } from '../direct/DirectClient'
import { DirectServer } from '../direct/DirectServer'
import { HttpClient } from '../http/HttpClient'
import { HttpServer } from '../http/HttpServer'
import { StdioClient } from '../stdio/StdioClient'
import { StdioServer } from '../stdio/StdioServer'
import { TcpClient } from '../tcp/TcpClient'
import { TcpServer } from '../tcp/TcpServer'
import { VsockServer } from '../vsock/VsockServer'
import { WebSocketClient } from '../ws/WebSocketClient'
import { WebSocketServer } from '../ws/WebSocketServer'
import { query } from './query'

const main = async (): Promise<void | schema.Node> => {
  // Collect configuration options
  const { args = ['help'], options, config, valid, log } = collectConfig<
    Config
  >('executa', configSchema)

  // Run the command
  const command = args[0]
  switch (command) {
    case 'help':
      return help(args[1])
    case 'conf':
      return conf(config)
    default: {
      if (!valid) process.exit(1)
      const executor = await init(config)
      switch (command) {
        case 'repl':
          return repl(executor, args[1], config.debug, log)
        case 'start':
        case 'serve':
          return start(executor)
        case 'convert':
          await convert(
            executor,
            log,
            args[1],
            options.from,
            args[2],
            options.to
          )
          break
        case 'compile':
          await compile(
            executor,
            log,
            args[1],
            options.from,
            args[2],
            options.to
          )
          break
        case 'query':
          await query(
            executor,
            log,
            args[1],
            options.from,
            args[2],
            options.to,
            args[3],
            options.lang
          )
          break
        case 'execute':
          await execute(
            executor,
            log,
            args[1],
            options.from,
            args[2],
            options.to
          )
          break
        default:
          log.error(`Unknown command: ${command}`)
      }
      return executor.stop()
    }
  }
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
const init = async (config: Config): Promise<Listener> => {
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
  if (stdio) servers.push(new StdioServer())
  if (vsock !== false)
    servers.push(
      new VsockServer(new VsockAddress(vsock === true ? undefined : vsock))
    )
  if (tcp !== false) servers.push(new TcpServer(tcp === true ? undefined : tcp))
  if (http !== false)
    servers.push(new HttpServer(http === true ? undefined : http))
  if (ws !== false)
    servers.push(new WebSocketServer(ws === true ? undefined : ws))

  // Client types that are available for connecting to peers
  const clientTypes: ClientType[] = [
    StdioClient,
    TcpClient,
    HttpClient,
    WebSocketClient
  ]

  // Configure the delegator with clients for each peer
  const { peers } = config
  const clients: Client[] = [
    new DirectClient(new DirectServer(new Worker())),
    ...(await addressesToClients(peers, clientTypes))
  ]
  const delegator = new Delegator(clients, clientTypes)

  // Configure the queue
  const queuer = new Queuer(config)

  return new Manager(servers, delegator, queuer)
}

/**
 * Start the executor
 */
const start = (executor: Executor): Promise<void> => executor.start()

/**
 * Stop the executor
 */
const stop = (executor: Executor): Promise<void> => executor.stop()

/**
 * Decode a document
 */
const decode = async (
  executor: Executor,
  log: Logger,
  source: string,
  format?: string
): Promise<schema.Node> => {
  return executor.decode(source, format)
}

/**
 * Encode a document
 */
const encode = async (
  executor: Executor,
  log: Logger,
  node: schema.Node,
  dest?: string,
  format?: string
): Promise<string> => {
  return executor.encode(node, dest, format)
}

/**
 * Convert a document
 */
const convert = async (
  executor: Executor,
  log: Logger,
  source: string,
  from?: string,
  dest?: string,
  to = 'json5'
): Promise<void> => {
  const decoded = await decode(executor, log, source, from)
  const encoded = await encode(executor, log, decoded, dest, to)
  if (dest === undefined) {
    console.log(encoded)
  }
}

/**
 * Compile a document
 */
const compile = async (
  executor: Executor,
  log: Logger,
  source: string,
  from?: string,
  dest?: string,
  to?: string
): Promise<schema.Node> => {
  const decoded = await decode(executor, log, source, from)
  const compiled = await executor.compile(decoded)
  if (dest !== undefined) await encode(executor, log, compiled, dest, to)
  return compiled
}

/**
 * Execute a document
 */
const execute = async (
  executor: Executor,
  log: Logger,
  source: string,
  from?: string,
  dest?: string,
  to?: string
): Promise<void> => {
  const decoded = await executor.decode(source, from)
  const compiled = await executor.compile(decoded)
  const executed = await executor.execute(compiled)
  if (dest === undefined) {
    dest = source
    if (to === undefined) to = from
  } else if (dest === '-') {
    dest = undefined
    if (to === undefined) to = 'md'
  }
  const encoded = await executor.encode(executed, dest, to)
  if (dest === undefined) {
    console.log(encoded)
  }
}

/**
 * A simple REPL for testing connection to, and configuration of,
 * executors.
 *
 * Sends requests to execute a `CodeChunk` with `programmingLanguage: 'sh'`
 * to the VM and prints it's `outputs` to the console. You can change the
 * language being used by typing a line starting with `<` e.g. `< py`
 */
const repl = async (
  executor: Listener,
  lang = 'python',
  debug: boolean,
  log: Logger
): Promise<void> => {
  // Reconfigure log handler to only show `info` and `debug` events
  // and error stacks when `--debug` option is set and to ensure
  // a new line so that does not interfere with notifications etc
  replaceHandlers(data => {
    console.error()
    defaultHandler(data, {
      maxLevel: debug ? LogLevel.debug : LogLevel.warn,
      showStack: debug
    })
  })

  // Create a client and server instead of calling executor
  // directly so that we can receive notifications
  const server = new DirectServer()
  const client = new DirectClient(server)
  await executor.start([server])

  // Function to create a prompt based on current language
  const prompt = (): string => `${chalk.green(lang)} ${chalk.grey('> ')}`

  // Create the REPL with the starting prompt
  const repl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: prompt()
  })
  repl.prompt()

  // The session that chunks will be executed in
  let session: schema.SoftwareSession | undefined

  // The string buffer that is used to collect text for chunks
  let buffer = ''

  // Function that handles each line
  const getLine = async (line: string): Promise<void> => {
    // Check if user wants to...

    // ...switch language
    const match = /^<\s*(\w+)/.exec(line)
    if (match !== null) {
      // Change language and provide new prompt
      lang = match[1].toLowerCase()
      repl.setPrompt(prompt())
      repl.prompt()
      return
    }

    // ...continue the line
    // We use backslash which is line continuation char in most
    // common languages e.g. JS, Python
    if (line.endsWith('\\')) {
      buffer += line.slice(0, -1)
      return
    }
    // ...continue the chunk on a new line
    // Useful where newlines are important e.g. `for` loops in Python
    if (line.endsWith('...')) {
      buffer += line.slice(0, -3) + '\n'
      return
    }

    // User entered a 'normal' line so add to buffer and
    // execute a `CodeChunk`
    buffer += line

    // Spinner to show notifications and elapsed time for
    // execution
    const spinner = ora({
      // With this set to true, all input is ignored while
      // the spinner is running and it affects subsequent
      // lines. Instead, we implement out own muting of stdin
      // while command is running.
      discardStdin: false
    })

    spinner.start()
    const started = Date.now()

    // Clear notifications before starting execution
    // giving the user a few seconds to read them.
    const notificationText = (
      notification: Client['notifications'][0]
    ): string => {
      const { message, date } = notification
      const age = Math.round((date.valueOf() - started) / 1000)
      return chalk`{grey ${age}s} ${message}`
    }
    const notificationDelay = (seconds = 3): Promise<void> =>
      new Promise(resolve => setTimeout(resolve, seconds * 1000))
    if (client.notifications.length > 0) {
      spinner.spinner = 'circleQuarters'
      spinner.color = 'yellow'
      for (const notification of client.notifications) {
        spinner.text = notificationText(notification)
        await notificationDelay()
      }
      client.notifications = []
    }

    spinner.spinner = 'dots'
    spinner.color = 'gray'
    const waitingSpinnerProps = async (): Promise<void> => {
      if (!spinner.isSpinning) return

      const seconds = Math.round((Date.now() - started) / 1000)
      spinner.color = [
        'gray',
        'blue',
        'cyan',
        'green',
        'yellow',
        'magenta',
        'red'
      ][Math.max(0, Math.min(Math.round(Math.log(seconds)), 6))] as Ora['color']

      while (client.notifications.length > 0 && spinner.isSpinning) {
        const last = client.notifications.splice(0, 1)[0]
        spinner.text = notificationText(last)
        await notificationDelay()
      }

      spinner.text = chalk.grey(`+${seconds}s`)

      setTimeout(() => {
        waitingSpinnerProps().catch(error => log.error(error))
      }, 1000)
    }
    await waitingSpinnerProps()

    // Begin session if necessary and ensure that it will be ended
    // before this process is existed
    if (session === undefined) {
      log.info('Beginning REPL session')
      session = await client.begin(schema.softwareSession())
      repl.on('SIGINT', () => {
        log.info('Ending REPL session')
        if (session !== undefined)
          client.end(session).catch(error => log.error(error))
        process.exit(0)
      })
    }

    // Execute chunk in session
    let outputs
    let errors
    try {
      ;({ outputs, errors } = await client.execute(
        schema.codeChunk(buffer, {
          programmingLanguage: lang
        }),
        session
      ))
    } catch (error) {
      // This will usually only occur if there is a capability
      // error because manager is unable to delegate.
      errors = [error]
    }

    // Clear the buffer
    buffer = ''

    // Stop the spinner
    spinner.stop()

    // Display any errors
    if (errors !== undefined && errors.length > 0) {
      for (const error of errors)
        if (error.message !== undefined)
          console.error(`${chalk.red(error.message)}`)
    }

    // Display any outputs
    if (outputs !== undefined && outputs.length > 0) {
      for (const output of outputs) {
        let display
        switch (typeof output) {
          case 'number':
            display = chalk.cyan(output)
            break
          case 'string':
            display = chalk.white(output)
            break
          default: {
            const json = JSON.stringify(
              output,
              null,
              Array.isArray(output) ? '' : '  '
            )
            display = chalk.blue(json)
          }
        }
        console.log(display)
      }
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

// Run the main function and log any exceptions
main().catch(err => console.error(err))
