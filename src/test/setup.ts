import { defaultHandler, replaceHandlers } from '@stencila/logga'

// Do not exit tests on logged errors
replaceHandlers((data) =>
  defaultHandler(data, {
    exitOnError: false,
  })
)
