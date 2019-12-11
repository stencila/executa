import { getLogger } from '@stencila/logga'
import { Executor, Manifest, Method, Capabilities, Params } from './Executor'
import { InternalError } from './InternalError'
import { CapabilityError } from './CapabilityError'
import * as schema from '@stencila/schema'

const log = getLogger('executa:worker')

/**
 * An `Executor` class that ...
 */
export class Worker extends Executor {
  /**
   * @override Override of {@link Executor.capabilities} to
   * declare capabilities of this executor class.
   */
  public capabilities(): Promise<Capabilities> {
    return Promise.resolve({
      // Can provide this manifest
      manifest: true,
      // Can decode string content of JSON format
      decode: {
        required: ['content'],
        properties: {
          content: { type: 'string' },
          format: { const: 'json' }
        }
      },
      // Can encode any node to JSON format
      encode: {
        required: ['node'],
        properties: {
          node: true,
          format: { const: 'json' }
        }
      }
    })
  }

  /**
   * @implements Implements {@link Executor.call} by
   */
  public call(method: Method, params: Params = {}): Promise<any> {
    switch (method) {
      case Method.manifest:
        return this.manifest()
      case Method.decode:
        return this.decode(params.content, params.format)
      case Method.encode:
        return this.encode(params.node, params.format)
      case Method.compile:
        return this.compile(params.node)
      case Method.build:
        return this.build(params.node)
      case Method.execute:
        return this.execute(params.node)
      case Method.begin:
        return this.begin(params.node)
      case Method.end:
        return this.end(params.node)
    }
    throw new InternalError(`Unhandled method ${method}`)
  }

  public decode(content: string, format: string): Promise<schema.Node> {
    if (format === 'json') return Promise.resolve(JSON.parse(content))
    throw new CapabilityError(`Unable to decode content of format "${format}"`)
  }

  public encode(node: schema.Node, format = 'json'): Promise<string> {
    if (format === 'json') return Promise.resolve(JSON.stringify(node))
    throw new CapabilityError(`Unable to encode node to format "${format}"`)
  }

  public compile<Type extends schema.Node>(node: Type): Promise<Type> {
    throw new CapabilityError(
      `Unable to compile node of type "${schema.nodeType(node)}"`
    )
  }

  public build<Type extends schema.Node>(node: Type): Promise<Type> {
    throw new CapabilityError(
      `Unable to build node of type "${schema.nodeType(node)}"`
    )
  }

  public execute<Type extends schema.Node>(node: Type): Promise<Type> {
    throw new CapabilityError(
      `Unable to execute node of type "${schema.nodeType(node)}"`
    )
  }

  public begin<Type extends schema.Node>(node: Type): Promise<Type> {
    throw new CapabilityError(
      `Unable to begin node of type "${schema.nodeType(node)}"`
    )
  }

  public end<Type extends schema.Node>(node: Type): Promise<Type> {
    throw new CapabilityError(
      `Unable to begin node of type "${schema.nodeType(node)}"`
    )
  }
}
