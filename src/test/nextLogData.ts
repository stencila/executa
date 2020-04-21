import { addHandler, LogData, removeHandler } from '@stencila/logga'

/**
 * Get a promise that resolves to the next log data that
 * matches the supplied tags.
 *
 * @param tags A list of tags that the log data must have
 */
export const nextLogData = (tags?: string[], count = 1): Promise<LogData[]> => {
  return new Promise((resolve) => {
    const data: LogData[] = []
    const handler = addHandler(
      (logData: LogData) => {
        data.push(logData)
        if (data.length === count) {
          resolve(data)
          removeHandler(handler)
        }
      },
      { tags }
    )
  })
}
