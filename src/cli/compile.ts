import { Logger } from '@stencila/logga'
import { Executor } from '../base/Executor'

/**
 * Compile a document
 */
export async function compile(
  executor: Executor,
  log: Logger,
  args: string[],
  options: { [key: string]: any }
): Promise<void> {
  const source = args[1]
  let dest: string | undefined = args[2]
  let { from, to } = options

  if (source === undefined) {
    return log.error('No source given.')
  }

  if (dest === undefined) {
    // No destination specified so default to the source
    dest = source
    if (to === undefined) to = from
  } else if (dest === '-') {
    // Destination is the console
    dest = undefined
  }

  if (dest === undefined && to === undefined) {
    to = 'json'
  }

  const decoded = await executor.decode(source, from)
  const compiled = await executor.compile(decoded)
  const encoded = await executor.encode(compiled, dest, to)
  if (dest === undefined) console.log(encoded)
}
