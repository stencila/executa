import { Logger } from '@stencila/logga'
import chalk from 'chalk'
import path from 'path'
import { schema } from '..'
import { Client } from '../base/Client'
import { Executor } from '../base/Executor'
import { repl } from './repl'

/**
 * Execute a document
 */
export async function execute(
  executor: Executor,
  log: Logger,
  args: string[],
  options: { [key: string]: any }
): Promise<void> {
  let source: string | undefined = args[1]
  if (source !== undefined) source = path.resolve(source)

  let dest: string | undefined = args[2]
  if (dest !== undefined) dest = path.resolve(dest)

  let { from, to, lang, repl: repl_ = false, debug } = options

  let executed: schema.Node
  if (source !== undefined) {
    // Execute the source document

    const decoded = await executor.decode(source, from)

    // Change into the directory of the source document, so that
    // relative paths, including those within `CodeChunks` that
    // are executed withing child processes, work.
    process.chdir(path.dirname(source))

    const compiled = await executor.compile(decoded)
    executed = await executor.execute(compiled)
  } else {
    // No source specified (e.g. if user wants a REPL for
    // a default environment)
    executed = null
  }

  if (dest === undefined && repl_ === false) {
    // No destination specified so default to the source
    dest = source
    if (to === undefined) to = from
  } else if (dest === '-') {
    // Destination is the console
    dest = undefined
  }

  if (repl_ !== false) {
    // Begin a new session
    const session = await executor.begin(schema.softwareSession())
    // Each text block is evaluated within the session
    // as a code chunk of the current language
    const evaluate = async (
      client: Client,
      job: string,
      doc: schema.Node,
      text: string,
      lang: string
    ): Promise<schema.Node | undefined> => {
      const chunk = schema.codeChunk({ text, programmingLanguage: lang })
      const executed = await client.execute(chunk, session, undefined, job)
      const { outputs, errors } = executed
      if (errors !== undefined && errors.length > 0) throw errors[0]
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
      debug,
    })
  } else {
    const encoded = await executor.encode(executed, dest, to)
    if (dest === undefined) console.log(encoded)
  }
}

const replHelp = chalk`
You can executa code chunks within the active document
using the following languages. Use the {cyan %lang} command (see below) to
change the language.
`.trimLeft()
