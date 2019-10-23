/**
 * A simple console for testing connection to, and configuration of,
 * executors.
 *
 * Usage:
 *
 * ```bash
 * ts-node console
 * ```
 *
 * For full debug level log messages use:
 *
 * ```bash
 * ts-node console --debug
 * ```
 *
 * Sends requests to execute a `CodeChunk` with `programmingLanguage: 'sh'`
 * to the VM and prints it's `outputs` to the console.
 */

import { ClientType } from './base/Client'
import { Executor } from './base/Executor'
import discoverHttp from './http/discover'
import HttpClient from './http/HttpClient'
// import discoverTcp from './tcp/discover'
// import TcpClient from './tcp/TcpClient'
import WSClient from './ws/WebSocketClient'

const red = '\u001b[31;1m'
const blue = '\u001b[34;1m'
const reset = '\u001b[0m'

// @ts-ignore
window.process = {
  // @ts-ignore
  emit: console.log // eslint-disable-line
}

// eslint-disable-next-line
;(async () => {
  // Create executor (no need to start it, since it has no servers)
  const executor = new Executor(
    [discoverHttp],
    [HttpClient as ClientType, WSClient as ClientType]
  )

  const makeCodeChunk = async (text: string): Promise<string> =>
    executor.encode({
      type: 'CodeChunk',
      programmingLanguage: 'python',
      text: text
    })

  const inputs = document.querySelector<HTMLTextAreaElement>('textarea')
  if (inputs === null) return

  inputs.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey === true) {
      console.log()
      // const result = await makeCodeChunk(inputs.textContent)
      // window.alert(result)
    }
  })
})()
