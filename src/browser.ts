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
import { BaseExecutor } from './base/BaseExecutor'
import { discover as discoverHttp } from './http/discover'
import { HttpClient } from './http/HttpClient'
import { WebSocketClient } from './ws/WebSocketClient'

// @ts-ignore
window.process = {
  // @ts-ignore
  emit: console.log // eslint-disable-line
}

// eslint-disable-next-line
;(async () => {
  // Create executor (no need to start it, since it has no servers)
  const executor = new BaseExecutor(
    [discoverHttp],
    [HttpClient as ClientType, WebSocketClient as ClientType]
  )

  const makeCodeChunk = (text: string): Promise<string> =>
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
