import { collectConfig, helpUsage } from '@stencila/configa'
import * as schema from '@stencila/schema'
import { Executor } from '../base/Executor'
import { Listener } from '../base/Listener'
import { Config } from '../config'
import configSchema from '../config.schema.json'
import { compile } from './compile'
import { convert } from './convert'
import { execute } from './execute'
import { init } from './init'
import { query } from './query'

export const main = async (
  executor?: Listener
): Promise<void | schema.Node> => {
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
      if (executor === undefined) {
        executor = await init(config)
      }
      switch (command) {
        case 'register':
          return register(executor)
        case 'start':
        case 'serve':
          return start(executor)
        case 'convert':
          await convert(executor, log, args, options)
          break
        case 'compile':
          await compile(executor, log, args, options)
          break
        case 'query':
          await query(executor, log, args, options)
          break
        case 'execute':
          await execute(executor, log, args, options)
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
 * Register the executor
 */
const register = (listener: Listener): Promise<string> => {
  return listener.register()
}

/**
 * Start the executor
 */
const start = (executor: Executor): Promise<void> => executor.start()
