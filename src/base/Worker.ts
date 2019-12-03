import { getLogger } from '@stencila/logga';
import { Executor, Manifest, Method, Call, Capabilities } from "./Executor";
import { InternalError } from './InternalError';
import { CapabilityError } from './CapabilityError';
import { Node, nodeType } from '@stencila/schema';

const log = getLogger('executa:worker')

/**
 * An `Executor` class that ...
 */
export class Worker extends Executor {

  /**
   * @implements Implements {@link Executor.call} by
   */
  public async call(
    method: Method,
    params: Call['params'] = {}
  ): Promise<any> {
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

  public async manifest(): Promise<Manifest> {
    const capabilities: Capabilities = {
      decode: [
        // Can decode string content of JSON format
        {
          properties: {
            content: { type: 'string' },
            format: { const: 'json' }
          },
          required: ['content']
        }
      ],
      encode: [
        // Can encode any node to JSON format
        {
          properties: {
            node: true,
            format: { const: 'json' }
          },
          required: ['node']
        }
      ]
    }
    return {
      capabilities
    }
  }

  public async decode(content: string, format: string): Promise<Node> {
    if (format === 'json') return JSON.parse(content)
    throw new CapabilityError(`Unable to decode content of format "${format}"`)
  }

  public async encode(node: Node, format = 'json'): Promise<string> {
    if (format === 'json') return JSON.stringify(node)
    throw new CapabilityError(`Unable to encode node to format "${format}"`)
  }

  public async compile<Node>(node: Node): Promise<Node> {
    throw new CapabilityError(`Unable to compile node of type "${nodeType(node)}"`)
  }

  public async build<Node>(node: Node): Promise<Node> {
    throw new CapabilityError(`Unable to build node of type "${nodeType(node)}"`)
  }

  public execute<Node>(
    node: Node,
  ): Promise<Node> {
    throw new CapabilityError(`Unable to execute node of type "${nodeType(node)}"`)
  }

  public begin<Node>(
    node: Node
  ): Promise<Node> {
    throw new CapabilityError(`Unable to begin node of type "${nodeType(node)}"`)
  }

  public end<Node>(node: Node): Promise<Node> {
    throw new CapabilityError(`Unable to begin node of type "${nodeType(node)}"`)
  }
}
