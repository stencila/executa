import { Manager } from '../base/Manager'
import { Node } from '@stencila/schema'
import { Claims } from '../base/Executor'

/**
 * A test `Executor` which echos back the arguments
 * it received as a new object. Used for testing that
 * `Server` implementations pass through arguments correctly.
 */
export class EchoExecutor extends Manager {
  begin<NodeType extends Node>(
    node: NodeType,
    claims: Claims = {}
  ): Promise<NodeType> {
    // This intentionally breaks contract to return the same node type as received
    return Promise.resolve(({ node, claims } as unknown) as NodeType)
  }
}
