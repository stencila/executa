import '@stencila/components'
import { Executor } from '../base/Executor'
import discover from '../http/discover'
import { default as HttpClient } from '../http/HttpClient'
import { default as WSClient } from '../ws/WebSocketClient'
import { ClientType } from '../base/Client'
import { codeChunk, SoftwareSession } from '@stencila/schema'

const jwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1NzE3ODA0NDd9.Q33AWdLDiJJQrWFfVkFgOT94dipKCXEzSPze0OS49C0'

const discoverStub = [
  async () => [
    {
      addresses: {
        ws: {
          type: 'ws',
          host: '127.0.0.1',
          port: '9000',
          jwt
        }
      },
      capabilities: {
        execute: true
      }
    }
  ]
]

// @ts-ignore
const executor = new Executor(discoverStub, [
  HttpClient as ClientType,
  WSClient as ClientType
])

let sessionRef: undefined | SoftwareSession

const makeCodeChunk = async (text: string): Promise<string> => {
  const code = codeChunk(text, { programmingLanguage: 'python' })
  // @ts-ignore
  console.log(JSON.stringify(code, null, 2))
  // TODO: Check for session, if not executor.begin().then(session => seessionRef = session; executor.execute(code, session))
  // return executor.execute(code, sessionRef)
  return executor.execute(code)
}

const executeHandler = (text: string) => makeCodeChunk(text).then(console.log)

const setCodeChunkProps = () => {
  const codeChunks = document.querySelectorAll('stencila-code-chunk')
  codeChunks.forEach(chunk => {
    // @ts-ignore
    chunk.executeHandler = executeHandler
  })
}

const onReadyHandler = (): void => {
  setCodeChunkProps()
  // TODO: Store session info
}

export const init = (): void => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReadyHandler)
  } else {
    onReadyHandler()
  }
}

init()
