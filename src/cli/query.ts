import { Logger } from '@stencila/logga'
import chalk from 'chalk'
import { highlight } from 'cli-highlight'
// @ts-ignore
import * as readline from 'historic-readline'
import { Executor } from '../base/Executor'
import * as schema from '@stencila/schema'
import { home } from '../util'

/**
 * Query a document
 */
export async function query(
  executor: Executor,
  log: Logger,
  source: string,
  from?: string,
  dest?: string,
  to = 'json5',
  query = '...',
  lang = 'jmp'
): Promise<void> {
  if (dest === '-') {
    dest = undefined
  }

  const decoded = await executor.decode(source, from)
  const compiled = await executor.compile(decoded)
  if (query === '...') {
    return repl(compiled, executor, log, dest, to, lang)
  } else {
    const result = await executor.query(compiled, query, lang)
    const encoded = await executor.encode(result, dest, to)
    if (dest === undefined) console.log(encoded)
  }
}

const replHelp = chalk`
{bold Queries}:

{bold {red jmp >} JMES Path}

  See http://jmespath.org/ for syntax and tutorial.

  Examples:

  {cyan content}
  {grey Get the content of the document}

  {cyan content[? type=='CodeChunk'].text}
  {grey Get the text of all the CodeChunk nodes in the document}

  {cyan \{type:'Article', content:content[?type=='CodeBlock']\}}
  {grey Create a new article containing the CodeBlock nodes
  in the current document}

{bold {red jpo >} JSON Pointer}

  See https://tools.ietf.org/html/rfc6901 for syntax.

  Examples:

  {cyan title}
  {grey Get the title of the document}

  {cyan content/0/type}
  {grey Get the type of the first node in the document content}


{bold Commands}:

{red %help}            Get this help message

{red %hist}            Get the history of queries and commands

{red %lang} {blue [lang]}     Get or set the query language
                 e.g. {cyan %lang jmp}, {cyan %lang sql}.

{red %format} {blue [format]} Get or set the format for query results
                 e.g. {cyan %format html},  {cyan %format json}


{red %dest} {blue [file]}     Get or set the destination for query results
                 Use "-" to set the destination back to the console.
                 e.g. {cyan %dest my.docx}, {cyan %dest folder/report.md}.


`

/**
 * A read-eval-print-loop for queries
 *
 * @param executor The executor to do the evaluation
 * @param logger The logger to send log events to
 * @param dest The destination for query results
 * @param format The format for query results
 * @param lang The language for queries
 */
function repl(
  document: schema.Node,
  executor: Executor,
  log: Logger,
  dest?: string,
  format?: string,
  lang = 'jmp'
): Promise<void> {
  let repl: readline.ReadLine
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 500,
    maxLength: 500,
    path: home('history', 'executa-query-repl.txt'),
    next: (rl: any) => (repl = rl)
  })
  setPrompt()
  repl.prompt()

  repl.on('line', (line: string) => {
    onLine(line)
      .then(() => repl.prompt())
      .catch(error => log.error(error))
  })

  return new Promise(resolve => {
    repl.on('SIGINT', () => {
      repl.close()
      resolve()
    })
  })

  // Set the RELP prompt with the current language
  function setPrompt(): void {
    repl.setPrompt(`${chalk.green(lang)} ${chalk.grey('> ')}`)
  }

  // Handle a line of user input
  async function onLine(line: string): Promise<void> {
    const match = /^\s*%([a-z]+)\s*(.*)$/.exec(line)
    if (match !== null) {
      onCommand(match[1], match[2])
    } else if (line.trim().length > 0) {
      let result
      try {
        result = await executor.query(document, line, lang)
      } catch (error) {
        log.error(error)
      }
      if (result !== undefined) {
        // If there is no format defined, and no destination to infer it from,
        // defaults to json5.
        const fmt =
          format === undefined && dest === undefined ? 'json5' : format
        const encoded = await executor.encode(result, dest, fmt)
        if (dest === undefined) outputToConsole(encoded, fmt)
      }
    }
  }

  // Handle a user command
  function onCommand(command: string, value: string) {
    switch (command) {
      case 'help':
        console.log(replHelp)
        break
      case 'hist':
        console.log(chalk.magenta(repl.history.reverse().join('\n')))
        break
      case 'lang':
        if (value.length > 0) {
          lang = value
          setPrompt()
        } else console.log(chalk.magenta(lang))
        break
      case 'dest':
        if (value.length > 0) {
          dest = value === '-' ? undefined : value
          format = undefined
        } else console.log(chalk.magenta(dest === undefined ? '-' : dest))
        break
      case 'format':
        if (value.length > 0) format = value
        else console.log(chalk.magenta(format))
        break
      default:
        log.error(`Invalid command: ${command}`)
    }
  }
}

// Output result to the console with format highlighting
function outputToConsole(encoded: string, format = 'json5') {
  // Get the Highlight.js language for the format,
  // falling back to the format name itself.
  const languages: { [key: string]: string } = {
    jsonld: 'json',
    json5: 'js'
  }
  let language = languages[format]
  if (language === undefined) language = format
  // Handle exception if Highlight.js can not highlight
  // the code of does not recognize the format.
  try {
    console.log(
      highlight(encoded, {
        language,
        theme: {
          // Default theme overrides
          // https://github.com/felixfbecker/cli-highlight/blob/b3bd5222c/src/theme.ts#L299
          string: chalk.yellow
        }
      })
    )
  } catch {
    console.log(encoded)
  }
}
