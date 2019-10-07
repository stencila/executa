/* eslint-disable */

import { getLogger } from '@stencila/logga'
import { ExecutorBackend, StencilaPythonBackend } from './backends'

const log = getLogger('engine:serve')

export default class Executa {
  backends: { [key: string]: ExecutorBackend } = {}

  getBackend(name: string): ExecutorBackend {
    if (this.backends[name] === undefined) {
      switch (name) {
        case 'python':
          this.backends[name] = new StencilaPythonBackend()
          break
        default:
          throw new Error(`Unknown backend '${name}'`)
      }
      this.backends[name].setup()
    }

    return this.backends[name]
  }

  async execute(code: any): Promise<any> {
    const backend = this.getBackend(code.programmingLanguage)

    return await backend.execute(code)
  }
}
