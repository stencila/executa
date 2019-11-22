import { addHandler, LogData, removeHandler } from '@stencila/logga'

/**
 * Get a promise that resolves to the next log data that
 * matches the supplied tags.
 *
 * @param tags A list of tags that the log data must have
 */
export const nextLogData = (tags?: string[]): Promise<LogData> => {
  return new Promise(resolve => {
    const handler = addHandler(
      (logData: LogData) => {
        resolve(logData)
        removeHandler(handler)
      },
      { tags }
    )
  })
}
