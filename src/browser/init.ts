import '@stencila/components'
import { CodeChunk, softwareSession, SoftwareSession } from '@stencila/schema'
import { BaseExecutor } from '../base/BaseExecutor'
import { ClientType } from '../base/Client'
import { HttpAddress } from '../base/Transports'
import { discover } from '../http/discover'
import { HttpClient } from '../http/HttpClient'
import { WebSocketClient } from '../ws/WebSocketClient'

let executor: BaseExecutor
let session: null | SoftwareSession = null

const executeCodeChunk = async (codeChunk: CodeChunk): Promise<CodeChunk> => {
  if (session === null) {
    session = await executor.begin(softwareSession())
  }

  return executor.execute(codeChunk)
}

const executeHandler = (codeChunk: CodeChunk): Promise<CodeChunk> =>
  executeCodeChunk(codeChunk)
    .then(res => res)
    .catch(err => {
      console.error(err)
      return codeChunk
    })

const setCodeChunkProps = (): void => {
  const codeChunks = document.querySelectorAll('stencila-code-chunk')
  codeChunks.forEach(chunk => {
    // @ts-ignore executeHandler is not a property of Element
    chunk.executeHandler = executeHandler
  })
}

const onReadyHandler = (): void => {
  setCodeChunkProps()
}

export const init = (options: Partial<InitOptions> = defaultOptions): void => {
  const { host, path, port } = { ...defaultOptions, ...options }

  executor = new BaseExecutor(
    [() => discover(new HttpAddress({ host, port }, path))],
    [HttpClient as ClientType, WebSocketClient as ClientType]
  )

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReadyHandler)
  } else {
    onReadyHandler()
  }
}

interface InitOptions {
  host: string
  port: number
  path: string
}

const host: string = window.location.hostname.includes('localhost')
  ? 'localhost'
  : 'hub.stenci.la'

const defaultOptions: InitOptions = {
  host,
  path: '',
  port: 9000
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
