import { Logger, LogLevel, replaceHandlers } from '@stencila/logga'
import * as schema from '@stencila/schema'
import chalk from 'chalk'
import { highlight, supportsLanguage } from 'cli-highlight'
// @ts-ignore
import * as readline from 'historic-readline'
import ora, { Ora } from 'ora'
import { Client } from '../base/Client'
import { Executor } from '../base/Executor'
import * as uid from '../base/uid'
import { DirectClient } from '../direct/DirectClient'
import { DirectServer } from '../direct/DirectServer'
import { home } from '../util'

/**
 * A read-evaluate-print-loop interface
 *
 * Used by `query` and `execute` commands when
 * in interactive mode. Outputs the the result of queries
 * or executions inf alternative formats, to
 * file, or to the console with syntax highlighting.
 *
 * @param tag Tag used to identify this EPL (for history etc)
 * @param document The active document
 * @param executor The executor to do the evaluation
 * @param logger The logger to send log events to
 * @param evaluate The function to evaluate
 * @param options Starting values for options
 * @param options.dest The destination for query results
 * @param options.format The format for query results
 * @param options.lang The language for queries
 */
export async function repl(
  tag: string,
  document: schema.Node,
  executor: Executor,
  log: Logger,
  evaluate: (
    client: Client,
    job: string,
    doc: schema.Node,
    line: string,
    lang: string
  ) => Promise<schema.Node | undefined>,
  help: string,
  options: {
    dest?: string
    format?: string
    lang: string
    debug?: boolean
  }
): Promise<void> {
  // Most of these options that can be changed by the user
  // using "commands"
  let { dest, format, lang, debug = false } = options

  // Buffer of text that the user can add lines to
  let buffer = ''
  let continuing = false

  let spinnerMessage = ''
  const spinner = ora({
    spinner: 'dots',
    // With this set to true, all input is ignored while
    // the spinner is running and it affects subsequent
    // lines. Instead, we implement out own muting of stdin
    // while command is running.
    discardStdin: false
  })

  // Only print log and notification messages to the console
  // when the user is waiting for a result, so
  // that they do not interfere with input
  const messages: string[] = []
  let mute = false
  function onMessage(message: string): void {
    if (mute) {
      messages.push(message)
    } else {
      spinner.clear()
      process.stdout.write(message + '\n')
    }
  }
  function clearMessages(): void {
    spinner.clear()
    for (const message of messages) {
      process.stdout.write(message + '\n')
    }
    messages.length = 0
  }

  // Reconfigure log handler to only show `debug` events
  // and error stacks when `--debug` option is set and to ensure
  // the spinner is cleared first
  replaceHandlers(data => {
    const { level, tag, message, stack } = data
    if (!debug && level > LogLevel.info) return
    const emoji = ['🚨', '⚠', '🛈', '🔧'][level]
    const colour = [chalk.red, chalk.yellow, chalk.blue, chalk.grey][level]
    const label = LogLevel[level].toUpperCase()
    const display =
      `${emoji} ${colour(label.padEnd(5))} ${chalk.cyan(tag)} ${message}` +
      (debug && stack !== undefined ? '\n' + stack : '')
    onMessage(display)
  })

  // Create a client and server instead of calling executor
  // directly so that we can receive notifications
  const server = new DirectServer()
  await server.start(executor)
  class ReplClient extends DirectClient {
    notified(subject: string, message: string): void {
      const display = `🔔 ${chalk.magenta('NOTIF')} ${chalk.cyan(
        subject
      )} ${message}`
      onMessage(display)
    }
  }
  const client = new ReplClient(server)

  // Set up REPL
  let rl: readline.ReadLine
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 500,

    // Length and path of stored history
    maxLength: 500,
    path: home('history', `executa-repl-${tag}.txt`),

    next: (instance: readline.ReadLine) => (rl = instance)
  })
  setPrompt()
  mute = true
  rl.prompt()
  rl.on('line', (line: string) => onLine(line).catch(error => log.error(error)))

  // On  interrupt signal (Ctrl+C) cancel current request
  let job: string | undefined

  // On close signal (Ctrl+D) resolve this promise
  // so any clean up can be done after it.
  return new Promise<void>(resolve => {
    rl.on('SIGINT', () => {
      if (job !== undefined) {
        spinner.clear()
        spinnerMessage = 'Cancelling'
        executor
          .cancel(job)
          .then(cancelled => {
            spinnerMessage = cancelled ? 'Cancelled' : 'Noncancellable'
          })
          .catch(error => log.error(error))
      } else {
        rl.close()
        resolve()
      }
    })

    rl.on('close', () => {
      rl.close()
      resolve()
    })
  })

  /**
   * Event handler for the `readline` 'line' event.
   *
   * This function should be the only place that the
   * output is placed on stdout and the spinner is
   * altered.
   */
  async function onLine(line: string): Promise<void> {
    // Pause the input stream
    // Any input will be cached in the buffer until resumed
    // with new prompt below.
    // Unfortunately, this also ignores SIGINT, so we don't
    // do this until we find a better way to handle that.
    // rl.pause()

    // Show any messages and turn off muting
    clearMessages()
    mute = false

    // Start the spinner and update it to show elapsed time
    // and any messages
    spinner.color = 'gray'
    spinnerMessage = ''
    const started = Date.now()
    const spinnerUpdate = (): void => {
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
      spinner.text = chalk.grey(`+${seconds}s ${spinnerMessage}`)
    }
    spinnerUpdate()
    spinner.start()
    const interval = setInterval(spinnerUpdate, 1000)

    // Handle the line and get any output
    const output = await handleLine(line)

    // Stop the spinner and mute messages
    // before writing any output
    spinner.stop()
    clearInterval(interval)
    mute = true

    if (output !== undefined) process.stdout.write(output + '\n')

    // Resume readline with prompt
    rl.prompt()
  }

  /**
   * Handle a line of user input
   */
  async function handleLine(line: string): Promise<string | void> {
    // Check if the user want to issue a command
    const match = /^\s*%([a-z]+)\s*(.*)$/.exec(line)
    if (match !== null) {
      return runCommand(match[1], match[2])
    }

    // Check if the user wants to continue the line
    // We use backslash which is line continuation char in most
    // common languages e.g. JS, Python
    if (line.endsWith('\\')) {
      buffer += line.slice(0, -1)
      continuing = true
      return setPrompt()
    }
    // Check if the user wants to continue the text block on a new line
    // Useful where newlines are important e.g. `for` loops in Python
    if (line.endsWith('...')) {
      buffer += line.slice(0, -3) + '\n'
      continuing = true
      return setPrompt()
    }

    // User entered a 'normal' line so clear the buffer and evaluate
    const text = buffer + line
    buffer = ''
    continuing = false
    setPrompt()

    // Evaluate if the buffer contains any non-whitespace
    if (text.trim().length > 0) {
      let result
      try {
        job = uid.generate('jo').toString()
        result = await evaluate(client, job, document, text, lang)
      } catch (error) {
        if (schema.isA(error, 'CodeError')) return displayError(error)
        else log.error(error)
      } finally {
        job = undefined
      }

      if (result !== undefined) {
        // If there is no format defined, and no destination to infer it from,
        // defaults to JSON (because that is available even it Encoda is not).
        const encoded = await client.encode(
          result,
          dest,
          format === undefined && dest === undefined ? 'json' : format
        )
        if (dest === undefined)
          return displayOutput(encoded, format === undefined ? 'json' : format)
      }
    }
  }

  /**
   * Set the prompt
   */
  function setPrompt(): void {
    const prompt = continuing ? ''.padEnd(lang.length) : chalk.green(lang)
    rl.setPrompt(prompt + chalk.grey(' > '))
  }

  /**
   * Run a command
   */
  function runCommand(command: string, value: string): string | void {
    switch (command) {
      case 'help':
        return help + commandsHelp
      case 'hist':
        return displaySetting(rl.history.reverse().join('\n'))
      case 'lang':
        if (value.length > 0) {
          lang = value
          setPrompt()
          break
        } else {
          return displaySetting(lang)
        }
      case 'dest':
        if (value.length > 0) {
          dest = value === '-' ? undefined : value
          format = undefined
          break
        } else {
          return displaySetting(dest === undefined ? '-' : dest)
        }
      case 'format':
        if (value.length > 0) {
          format = value
          break
        } else {
          return displaySetting(format === undefined ? '-' : format)
        }
      default:
        log.error(`Invalid command: ${command}`)
    }
  }
}

/**
 * Display output in a particular format
 */
function displayOutput(encoded: string, format: string): string {
  // Get the Highlight.js language for the format,
  // falling back to the format name itself.
  // If you get a message like:
  //   Could not find the language 'txt', did you forget to load/include a language module?
  // add an entry here!
  const languages: { [key: string]: string } = {
    jsonld: 'json',
    json5: 'javascript'
  }
  let language = languages[format]
  if (language === undefined) language = format
  if (!supportsLanguage(language)) language = 'plaintext'
  // Handle exception if Highlight.js can not highlight
  // the code of does not recognize the format.
  try {
    return highlight(encoded, {
      language,
      theme: {
        // Default theme overrides
        // https://github.com/felixfbecker/cli-highlight/blob/b3bd5222c/src/theme.ts#L299
        string: chalk.yellow
      }
    })
  } catch {
    return encoded
  }
}

/**
 * Display an error
 */
function displayError(error: schema.CodeError): string {
  return chalk.red(error.errorMessage ?? 'Unknown error')
}

/**
 * Display the value of a setting.
 */
function displaySetting(text: string): string {
  return chalk.magenta(text)
}

const commandsHelp = chalk`

{bold Commands}:

{bold {red %help}}            Get this help message

{bold {red %hist}}            Get the history of queries and commands

{bold {red %lang}} {blue [lang]}     Get or set the query language
                 e.g. {cyan %lang jmp}, {cyan %lang sql}.

{bold {red %format}} {blue [format]} Get or set the format for query results
                 e.g. {cyan %format html},  {cyan %format json}


{bold {red %dest}} {blue [file]}     Get or set the destination for query results
                 Use "-" to set the destination back to the console.
                 e.g. {cyan %dest my.docx}, {cyan %dest folder/report.md}.
`
