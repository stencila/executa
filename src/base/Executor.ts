import * as stencila from '@stencila/schema'

export enum Method {
  capabilities = 'capabilities',
  convert = 'convert',
  compile = 'compile',
  build = 'build',
  execute = 'execute'
}

export type Capabilities = {[key in Method]: any}

/**
 */
export default class Executor {

  /**
   * Get the capabilities of this executor
   */
  async capabilities (): Promise<Capabilities> {
    return {
      capabilities: true,
      convert: false,
      compile: false,
      build: false,
      execute: false
    }
  }

  async convert (node: string | stencila.Node, from: string = 'json', to: string = 'json'): Promise<string> {
    if (typeof node === 'string') return node
    else return JSON.stringify(node)
  }

  async compile (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return node
  }

  async build (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return node
  }

  async execute (node: string | stencila.Node, format: string = 'json'): Promise<stencila.Node> {
    return node
  }
}
