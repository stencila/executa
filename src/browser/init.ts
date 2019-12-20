import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import { WebSocketAddressInitializer } from '../base/Transports'
import { WebSocketClient } from '../ws/WebSocketClient'

const log = getLogger('executa:browser')

let client: WebSocketClient
let session: null | schema.SoftwareSession = null

const executeCodeChunk = async (
  codeChunk: schema.CodeChunk
): Promise<schema.CodeChunk> => {
  if (session === null) {
    session = await client.begin(schema.softwareSession())
  }
  try {
    return client.execute(codeChunk, session)
  } catch (error) {
    log.error(error)
    return codeChunk
  }
}

const setCodeChunkProps = (): void => {
  const codeChunks = document.querySelectorAll('stencila-code-chunk')
  codeChunks.forEach(chunk => {
    // @ts-ignore executeHandler is not a property of Element
    chunk.executeHandler = executeCodeChunk
  })
}

const onReadyHandler = (): void => {
  setCodeChunkProps()
}

export const init = (address: WebSocketAddressInitializer): void => {
  client = new WebSocketClient(address)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReadyHandler)
  } else {
    onReadyHandler()
  }
}

const executa = {
  init
}

const Stencila = {
  // @ts-ignore
  ...(window.Stencila !== undefined ? window.Stencila : {}),
  executa
}

// @ts-ignore
window.Stencila = Stencila
