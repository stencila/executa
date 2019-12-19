import { Logger } from '@stencila/logga'
import { Executor } from '../base/Executor'

/**
 * Convert a document
 */
export async function convert(
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

  if (dest === undefined || dest === '-') {
    // Destination is the console
    dest = undefined
  }

  if (dest === undefined && to === undefined) {
    to = 'json'
  }

  const decoded = await executor.decode(source, from)
  const encoded = await executor.encode(decoded, dest, to)
  if (dest === undefined) console.log(encoded)
}
