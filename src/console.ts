/**
 * A simple console for testing connection to, and configuration of,
 * executors.
 *
 * Usage:
 *
 * ```bash
 * ts-node console
 * ```
 *
 * For full debug level log messages use:
 *
 * ```bash
 * ts-node console --debug
 * ```
 *
 * Sends requests to execute a `CodeChunk` with `programmingLanguage: 'sh'`
 * to the VM and prints it's `outputs` to the console.
 */

import {
  getLogger,
  LogLevel,
  replaceHandlers,
  defaultHandler
} from '@stencila/logga'
import minimist from 'minimist'
import * as readline from 'readline'
import { ClientType } from './base/Client'
import Executor, { Manifest, Method } from './base/Executor'
import TcpClient from './tcp/TcpClient'
import discoverTcp from './tcp/discover'
import { CodeChunk } from '@stencila/schema'

const { _, ...options } = minimist(process.argv.slice(2))

const log = getLogger('executa:console')

const red = '\u001b[31;1m'
const blue = '\u001b[34;1m'
const reset = '\u001b[0m'

/**
 * Configure log handler to only show `info` and `debug` events
 * when `--debug` flag is set
 */
replaceHandlers(data => {
  const { level } = data
  if (level <= (options.debug !== undefined ? LogLevel.debug : LogLevel.warn)) {
    process.stderr.write(`--- `)
    defaultHandler(data, { level: LogLevel.debug })
  }
})

// eslint-disable-next-line
;(async () => {
  // Collect manifest of the peer `TcpServer`
  const manifests: Manifest[] = await discoverTcp()
  const clientTypes: ClientType[] = [TcpClient as ClientType]
  log.debug(`Obtained manifests: ${JSON.stringify(manifests, null, ' ')}`)

  // Create executor (no need to start it, since it has no servers)
  const executor = new Executor(manifests, clientTypes)

  // Create the REPL with the starting prompt
  const repl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>>> '
  })
  repl.prompt()

  // For each line the user enters...
  repl.on('line', async (line: string) => {
    // When user enters a line, execute a `CodeChunk`
    const result = (await executor.execute({
      type: 'CodeChunk',
      programmingLanguage: 'python',
      text: line
    })) as CodeChunk

    // Display any errors
    if (result.errors !== undefined && result.errors.length > 0) {
      process.stderr.write(red)
      for (const error of result.errors)
        if (error.message !== undefined) process.stderr.write(error.message)
      process.stderr.write(reset)
    }

    // Display any outputs
    if (result.outputs !== undefined && result.outputs.length > 0) {
      process.stdout.write(blue)
      for (const output of result.outputs) process.stdout.write(`${output}`)
      process.stdout.write(reset)
    }

    // Provide a new prompt
    repl.prompt()
  })
})()