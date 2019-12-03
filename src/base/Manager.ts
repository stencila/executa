import { getLogger } from '@stencila/logga'
import { isPrimitive, Node, nodeType, SoftwareSession } from '@stencila/schema'
import {
  Addresses,
  Capabilities,
  Manifest,
  Method,
  Claims,
  Executor
} from './Executor'
import { Listener } from './Listener'
import { Worker } from './Worker'
import { Queuer } from './Queuer'
import { Delegator } from './Delegator'

const log = getLogger('executa:manager')

/**
 * A base `Executor` class implementation.
 */
export class Manager extends Listener {
  worker: Executor

  constructor(
    worker: Executor = new Worker(),
    delegator?: Delegator,
    queuer?: Queuer
  ) {
    super()
    this.worker = worker
  }

  /**
   * Get the manifest of the executor
   *
   * Derived classes may override this method,
   * but will normally just override `capabilities()`.
   */
  public manifest(): Promise<Manifest> {
    return Promise.resolve({
      id: this.id,
      capabilities: {},
      addresses: this.addresses()
    })
  }

  public call(method: Method, params: { [key: string]: any }): Promise<any> {
    return this.worker.call(method, params)
  }

  protected async walk<NodeType extends Node>(
    root: NodeType,
    transformer: (node: Node) => Promise<Node>
  ): Promise<NodeType> {
    return walk(root) as Promise<NodeType>
    async function walk(node: Node): Promise<Node> {
      const transformed = await transformer(node)

      if (transformed !== node) return transformed

      if (transformed === undefined || isPrimitive(transformed))
        return transformed
      if (Array.isArray(transformed)) return Promise.all(transformed.map(walk))
      return Object.entries(transformed).reduce(
        async (prev, [key, child]) => ({
          ...(await prev),
          ...{ [key]: await walk(child) }
        }),
        Promise.resolve({})
      )
    }
  }
}
