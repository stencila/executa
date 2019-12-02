import '@stencila/components'
import { getLogger } from '@stencila/logga'
import { CodeChunk, softwareSession, SoftwareSession } from '@stencila/schema'
import { Manager } from '../base/Manager'
import { HttpAddressInitializer } from '../base/Transports'
import { discover } from '../http/discover'
import { HttpClient } from '../http/HttpClient'
import { WebSocketClient } from '../ws/WebSocketClient'

const log = getLogger('executa:browser')

let executor: Manager
let session: null | SoftwareSession = null

const executeCodeChunk = async (codeChunk: CodeChunk): Promise<CodeChunk> => {
  if (session === null) {
    session = await executor.begin(softwareSession())
  }
  try {
    return executor.execute(codeChunk, session)
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

export const init = (address: HttpAddressInitializer): void => {
  executor = new Manager(
    [() => discover(address)],
    [HttpClient, WebSocketClient]
  )

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
