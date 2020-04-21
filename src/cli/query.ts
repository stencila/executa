import { Logger } from '@stencila/logga'
import chalk from 'chalk'
import { Executor } from '../base/Executor'
import { repl } from './repl'
import { schema } from '..'
import { Client } from '../base/Client'

/**
 * Query a document
 */
export async function query(
  executor: Executor,
  log: Logger,
  args: string[],
  options: { [key: string]: any }
): Promise<void> {
  const source = args[1]
  const dest: string | undefined = args[2]
  const query: string = args[3]
  const {
    from,
    to = 'json5',
    lang = 'jmp',
    repl: repl_ = false,
    debug,
  } = options

  const decoded = await executor.decode(source, from)
  const compiled = await executor.compile(decoded)
  if (repl_ !== false) {
    const evaluate = async (
      client: Client,
      request: string,
      doc: schema.Node,
      text: string,
      lang: string
    ) => {
      return client.query(doc, text, lang)
    }
    return repl('query', compiled, executor, log, evaluate, replHelp, {
      dest,
      format: to,
      lang,
      debug,
    })
  } else {
    const result = await executor.query(compiled, query, lang)
    const encoded = await executor.encode(result, dest, to)
    if (dest === undefined) console.log(encoded)
  }
}

const replHelp = chalk`
{bold Queries}:

You can query the active document using the following
languages. Use the {cyan %lang} command (see below) to
change the language.

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
`.trim()
