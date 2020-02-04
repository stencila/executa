import { getLogger } from '@stencila/logga'
import { CapabilityError } from './errors'
import { Delegator } from './Delegator'
import { Method, Claims, Manifest } from './Executor'
import { Listener } from './Listener'
import { Queuer } from './Queuer'
import { Server } from './Server'
import { Worker } from './Worker'
import * as schema from '@stencila/schema'

const log = getLogger('executa:manager')

/**
 * An `Executor` class implementation which combines
 * a `Delegator` and a `Queuer`.
 */
export class Manager extends Listener {
  delegator: Delegator
  queuer: Queuer

  constructor(
    servers: Server[] = [],
    delegator: Delegator = new Delegator([new Worker()]),
    queuer: Queuer = new Queuer()
  ) {
    super('ma', servers)
    this.delegator = delegator
    this.queuer = queuer
  }

  /**
   * @override Override of {@link Listener.manifest} to
   * provide additional properties for inspection.
   */
  public async manifest(): Promise<Manifest> {
    const manifest = await super.manifest()
    const delegator = await this.delegator.manifest()
    const queuer = await this.queuer.manifest()
    return {
      ...manifest,
      delegator,
      queuer
    }
  }

  /**
   * @override Override of {@link Executor.compile} that compiles a
   * node by walking it and delegating the compilation of child
   * nodes to peers.
   */
  public async compile<Type extends schema.Node>(node: Type): Promise<Type> {
    return this.walk(node, async child => {
      if (!['CodeChunk', 'CodeExpression'].includes(schema.nodeType(child)))
        return child
      try {
        return await this.delegator.compile(child)
      } catch (error) {
        if (error instanceof CapabilityError) return Promise.resolve(child)
        else throw error
      }
    })
  }

  /**
   * @override Override of {@link Executor.execute} that executes a
   * node by walking it and delegating the execution of child
   * nodes to peers.
   *
   * Note that walk is async and that nodes do not wait for
   * previous nodes before executing.
   */
  public async execute<Type extends schema.Node>(
    node: Type,
    session?: schema.SoftwareSession,
    claims?: Claims,
    job?: string
  ): Promise<Type> {
    return this.walk(node, async child => {
      if (!['CodeChunk', 'CodeExpression'].includes(schema.nodeType(child)))
        return child
      try {
        return await this.delegator.execute(child, session, claims, job)
      } catch (error) {
        if (error instanceof CapabilityError) return Promise.resolve(child)
        else throw error
      }
    })
  }

  /**
   * @override Override of {@link Executor.cancel} that passes on
   * the request to the delegator.
   */
  public cancel(job: string): Promise<boolean> {
    return this.delegator.cancel(job)
  }

  /**
   * @override Overrides {@link Executor.begin} to begin a `SoftwareSession`
   * in the current environment.
   *
   * TODO: This method should only be called if
   * unable to delegate to a peer for a specific type of session
   */
  public async begin<Type>(node: Type, claims?: Claims): Promise<Type> {
    if (schema.isA('SoftwareSession', node)) {
      // TODO: Assign id and dateStart etc to session
      return Promise.resolve(node)
    }
    throw new CapabilityError(undefined, Method.begin, { node, claims })
  }

  /**
   * @override Overrides {@link Executor.end} to end a `SoftwareSession`
   * that was started here.
   *
   * TODO: Check that the session was begun here, otherwise delegate.
   */
  public async end<Type>(node: Type, claims?: Claims): Promise<Type> {
    // TODO
    return Promise.resolve(node)
  }

  /**
   * Do a depth first walk of a node applying a transformation function.
   *
   * This function has three characteristics to be aware of
   *   - recursively traverses **all** nodes, including the nodes
   *     resulting from transformation
   *   - awaits for the result of transformation of each child, in order
   *   - depth first
   *
   * These characteristics make it suitable for doing an "in order" traversal
   * of a node e.g. executing the nodes in a document in the order that they appear.
   * But in some cases it may be better to use a different function e.g. in
   * cases where you wish to traverse all nodes but the order does not matter.
   */
  protected async walk<NodeType extends schema.Node>(
    root: NodeType,
    transformer: (node: schema.Node) => Promise<schema.Node>
  ): Promise<NodeType> {
    return walk(root) as Promise<NodeType>
    async function walk(node: schema.Node): Promise<schema.Node> {
      const transformed = await transformer(node)

      if (transformed === undefined || schema.isPrimitive(transformed))
        return transformed

      if (Array.isArray(transformed))
        return transformed.reduce(
          async (prev, child) => [...(await prev), await walk(child)],
          Promise.resolve([])
        )

      return Object.entries(transformed).reduce(
        async (prev, [key, child]) => ({
          ...(await prev),
          [key]: await walk(child)
        }),
        Promise.resolve({})
      )
    }
  }

  /**
   * @override Override of {@link Executor.call} that
   * delegates the call.
   *
   * @description This is a fallback for methods that
   * are not implemented above.
   */
  public async call(
    method: Method,
    params: { [key: string]: any }
  ): Promise<any> {
    return this.delegator.call(method, params)
  }

  /**
   * @override Override of {@link Listener.start} which
   * also starts delegator and queuer and
   * periodic checking of the queue.
   */
  async start(servers: Server[] = []): Promise<void> {
    await super.start(servers)
    await this.delegator.start()
    await this.queuer.start()
    await this.queuer.check(this.delegator)
  }

  /**
   * @override Override of {@link Listener.stop} which
   * stops delegator (including any child processes it may have started)
   * and queuer.
   */
  async stop(): Promise<void> {
    await super.stop()
    await this.delegator.stop()
    await this.queuer.stop()
  }
}
