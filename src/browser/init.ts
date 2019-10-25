import '@stencila/components'
import {
  codeChunk,
  Node,
  softwareEnvironment,
  softwareSession,
  SoftwareSession
} from '@stencila/schema'
import { ClientType } from '../base/Client'
import { BaseExecutor } from '../base/BaseExecutor'
import { HttpAddress } from '../base/Transports'
import { discover } from '../http/discover'
import { HttpClient } from '../http/HttpClient'
import { WebSocketClient } from '../ws/WebSocketClient'

let executor: BaseExecutor
let sessionRef: null | SoftwareSession = null

const executeCodeChunk = async (text: string): Promise<Node> => {
  const code = codeChunk(text, { programmingLanguage: 'python' })

  if (sessionRef === null) {
    const session = softwareSession(
      softwareEnvironment('stencila/sparkla-ubuntu')
    )
    sessionRef = await executor.begin(session)
  }

  return executor.execute(code, sessionRef)
}

const executeHandler = (text: string): Promise<void> =>
  executeCodeChunk(text)
    .then(res => console.log(res))
    .catch(err => console.error(err))

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
