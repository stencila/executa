import { BaseExecutor } from '../base/BaseExecutor'
import { Node, SoftwareSession } from '@stencila/schema'

/**
 * A test `Executor` which echos back the arguments
 * it received as a new object. Used for testing that
 * `Server` implementations pass through arguments correctly.
 */
export class EchoExecutor extends BaseExecutor {
  begin<NodeType extends Node>(
    node: NodeType,
    limits?: SoftwareSession
  ): Promise<NodeType> {
    // This intentionally breaks contract to return the same node type as received
    return Promise.resolve(({ node, limits } as unknown) as NodeType)
  }
}
