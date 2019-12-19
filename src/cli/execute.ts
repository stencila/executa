import { Logger } from '@stencila/logga'
import chalk from 'chalk'
import { Executor } from '../base/Executor'
import { repl } from './repl'
import { schema } from '..'
import { Client } from '../base/Client'

/**
 * Execute a document
 */
export async function execute(
  executor: Executor,
  log: Logger,
  args: string[],
  options: { [key: string]: any }
): Promise<void> {
  const source = args[1]
  let dest: string | undefined = args[2]
  let { from, to, lang, repl: repl_ = false, debug } = options

  let executed: schema.Node
  if (source !== undefined) {
    // Execute the source document
    const decoded = await executor.decode(source, from)
    const compiled = await executor.compile(decoded)
    executed = await executor.execute(compiled)
  } else {
    // No source specified (e.g. if user wants a REPL for
    // a default environment)
    executed = null
  }

  if (dest === undefined) {
    // No destination specified so default to the source
    dest = source
    if (to === undefined) to = from
  } else if (dest === '-') {
    // Destination is the console
    dest = undefined
  }

  if (repl_ !== false) {
    // Each text block is evaluated as a code chunk of the current language
    const evaluate = async (
      client: Client,
      doc: schema.Node,
      text: string,
      lang: string
    ): Promise<schema.Node | undefined> => {
      const chunk = schema.codeChunk(text, {
        programmingLanguage: lang
      })
      const { outputs, errors } = await client.execute(chunk)
      if (errors !== undefined && errors.length > 0) {
        return errors
          .map(error => {
            const { kind, message } = error
            return chalk`🚫 {red ERROR} {cyan ${kind}} ${message}`
          })
          .join('\n')
      }
      return outputs
    }
    // Starting language for REPL defaults to Bash
    if (lang === undefined) lang = 'bash'
    // Starting output format for REPL defaults to plain text
    const format = to !== undefined ? to : 'txt'
    return repl('execute', executed, executor, log, evaluate, replHelp, {
      dest,
      format,
      lang,
      debug
    })
  } else {
    const format = to !== undefined ? to : 'json'
    const encoded = await executor.encode(executed, dest, format)
    if (dest === undefined) console.log(encoded)
  }
}

const replHelp = chalk`
You can executa code chunks within the active document
using the following languages. Use the {cyan %lang} command (see below) to
change the language.
`.trimLeft()
