import { BaseExecutor } from '../base/BaseExecutor'
import { Node } from '@stencila/schema'
import { User } from '../base/Executor'

/**
 * A test `Executor` which echos back the arguments
 * it received as a new object. Used for testing that
 * `Server` implementations pass through arguments correctly.
 */
export class EchoExecutor extends BaseExecutor {
  begin<NodeType extends Node>(
    node: NodeType,
    user: User = {}
  ): Promise<NodeType> {
    // This intentionally breaks contract to return the same node type as received
    return Promise.resolve(({ node, user } as unknown) as NodeType)
  }
}
