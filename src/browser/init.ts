import '@stencila/components'
import { CodeChunk, softwareSession, SoftwareSession } from '@stencila/schema'
import { BaseExecutor } from '../base/BaseExecutor'
import { ClientType } from '../base/Client'
import { HttpAddress, Transport } from '../base/Transports'
import { discover } from '../http/discover'
import { HttpClient } from '../http/HttpClient'
import { WebSocketClient } from '../ws/WebSocketClient'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:browser')

let executor: BaseExecutor
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

export const init = (options: Partial<InitOptions> = defaultOptions): void => {
  const { host, port, path, protocol, transport } = {
    ...defaultOptions,
    ...options
  }

  executor = new BaseExecutor(
    [
      () => discover(new HttpAddress({ host, port }, path, protocol, transport))
    ],
    [HttpClient as ClientType, WebSocketClient as ClientType]
  )

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReadyHandler)
  } else {
    onReadyHandler()
  }
}

interface InitOptions {
  host: HttpAddress['host']
  port: HttpAddress['port']
  path: HttpAddress['path']
  protocol: HttpAddress['protocol']
  transport: HttpAddress['type']
}

const defaultOptions: InitOptions = {
  host: window.location.hostname.includes('localhost')
    ? 'localhost'
    : 'hub.stenci.la',
  path: '',
  port: 9000,
  protocol: 'jsonrpc',
  transport:
    window.location.protocol === 'https' ? Transport.https : Transport.http
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
