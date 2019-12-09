import * as schema from '@stencila/schema'
import { Claims } from '../base/Executor'
import { Worker } from '../base/Worker'

/**
 * A test `Executor` which echos back the arguments
 * it received as a new object. Used for testing that
 * `Server` implementations pass through arguments correctly.
 */
export class EchoExecutor extends Worker {
  begin<Type extends schema.Node>(node: Type, claims?: Claims): Promise<Type> {
    // This intentionally breaks contract to return the same node
    // type as received
    return Promise.resolve(({ node, claims } as unknown) as Type)
  }
}
