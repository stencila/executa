import { getLogger } from '@stencila/logga'
import { softwareSession, SoftwareSession, CodeChunk } from '@stencila/schema'
import { WebSocketAddressInitializer } from '../base/Transports'
import { WebSocketClient } from '../ws/WebSocketClient'

const log = getLogger('executa:browser')

let client: WebSocketClient
let session: null | SoftwareSession = null

const executeCodeChunk = async (codeChunk: CodeChunk): Promise<CodeChunk> => {
  if (session === null) {
    session = await client.begin(softwareSession())
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
  codeChunks.forEach((chunk) => {
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
