/* eslint-disable */

import { getLogger } from '@stencila/logga'
import {
  ExecutorBackend,
  StencilaJsBackend,
  StencilaPythonBackend
} from './backends'

const log = getLogger('engine:serve')

export default class Executa {
  private backends: { [key: string]: ExecutorBackend } = {}

  private getBackend(name: string): ExecutorBackend {
    if (this.backends[name] === undefined) {
      switch (name) {
        case 'python':
          this.backends[name] = new StencilaPythonBackend()
          break
        case 'javascript':
          this.backends[name] = new StencilaJsBackend()
          break
        default:
          throw new Error(`Unknown backend '${name}'`)
      }
      this.backends[name].setup()
    }

    return this.backends[name]
  }

  public async execute(code: any): Promise<any> {
    const backend = this.getBackend(code.programmingLanguage)
    return backend.execute(code)
  }
}
