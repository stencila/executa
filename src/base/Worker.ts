import { getLogger } from '@stencila/logga'
import * as schema from '@stencila/schema'
import jmespath from 'jmespath'
import { Capabilities, Claims, Executor, Method, Params } from './Executor'

const log = getLogger('executa:worker')

/**
 * An `Executor` class that has some basic capabilities able to be
 * implemented easily in Javascript without heavy dependencies
 * (e.g.in the browser):
 *
 * - `decode` from, and `encode` to, JSON
 * - `select` from a node using JSON Pointer syntax
 * - `execute` a JavaScript `CodeExpression` not within a session
 * - `pipe` method calls
 */
export class Worker extends Executor {
  /**
   * @override Override of {@link Executor.capabilities} to
   * declare specific capabilities of this executor class.
   */
  public capabilities(): Promise<Capabilities> {
    return Promise.resolve({
      // Can provide this manifest
      manifest: true,
      // Can decode source of JSON format
      decode: {
        required: ['source', 'format'],
        properties: {
          source: { type: 'string' },
          format: { const: 'json' },
        },
      },
      // Can encode any node to JSON format
      encode: {
        required: ['node', 'format'],
        properties: {
          node: true,
          format: { const: 'json' },
        },
      },
      // Can query any node using JMES Path or JSON Pointer
      query: {
        required: ['node', 'query', 'lang'],
        properties: {
          node: true,
          query: { type: 'string' },
          lang: {
            enum: ['jmp', 'jmes-path', 'jpo', 'json-pointer'],
          },
        },
      },
      // Can execute a Javascript `CodeExpression` but
      // only if it is not associated with a session
      execute: {
        required: ['node'],
        additionalProperties: false,
        properties: {
          node: {
            required: ['type', 'programmingLanguage', 'text'],
            properties: {
              type: {
                const: 'CodeExpression',
              },
              programmingLanguage: {
                enum: ['js', 'javascript'],
              },
              text: {
                type: 'string',
              },
            },
          },
        },
      },
      // Can pipe together methods
      pipe: true,
    })
  }

  /**
   * @override Override of {@link Executor.decode} that
   * provides decoding of JSON.
   */
  public decode(source: string, format?: string): Promise<schema.Node> {
    if (format === 'json') return Promise.resolve(JSON.parse(source))
    return super.decode(source, format)
  }

  /**
   * @override Override of {@link Executor.encode} that
   * provides encoding to JSON.
   */
  public encode(
    node: schema.Node,
    dest?: string,
    format?: string
  ): Promise<string> {
    if (format === 'json' && dest === undefined)
      return Promise.resolve(JSON.stringify(node))
    return super.encode(node, format)
  }

  /**
   * @override Override of {@link Executor.query} to provide
   * implementations for JSON Pointer and JMESPath.
   */
  public query(
    node: schema.Node,
    query: string,
    lang = 'jmes-path'
  ): Promise<schema.Node> {
    if (lang === 'jpo' || lang === 'json-pointer') {
      const path = query
        .split('/')
        // Handle escaped character sequences
        // As per https://tools.ietf.org/html/rfc6901#section-4
        .map((item) => item.replace('~1', '/').replace('~0', '~'))
      let child = node
      for (const item of path) {
        // @ts-ignore
        child = child[item]
        if (child === undefined) break
      }
      return Promise.resolve(child)
    } else if (lang === 'jmp' || lang === 'jmes-path') {
      let result
      try {
        result = jmespath.search(node, query)
      } catch (error) {
        log.error(`Error with JMESPath: ${error.message}`)
      }
      return Promise.resolve(result)
    }
    return super.query(node, query, lang)
  }

  // Enclose in braces to avoid `{}` to be confused with a block.
  // This function cannot be inside `execute` as Babel complains with:
  // `Calling eval from inside an async function is not supported`
  // eslint-disable-next-line no-eval
  private evaluate = (text: string): schema.Entity => eval(`(${text})`)

  /**
   * @override Override of {@link Executor.execute} that
   * provides for execution of Javascript expressions.
   *
   * Will not attempt to execute an expression that has been
   * requested to be executed withing a session. ie. will
   * only work with "pure" expressions.
   */
  public async execute<Type extends schema.Node>(
    node: Type,
    session?: schema.SoftwareSession,
    claims?: Claims
  ): Promise<Type> {
    if (
      schema.isA('CodeExpression', node) &&
      node.programmingLanguage !== undefined &&
      ['js', 'javascript'].includes(node.programmingLanguage.toLowerCase()) &&
      session === undefined
    ) {
      const { text } = node
      if (text === undefined || text.trim().length === 0) return node
      try {
        node.output = this.evaluate(text)
      } catch (error) {
        const { name, message, trace } = error
        node.errors = [
          schema.codeError({
            errorType: name,
            errorMessage: message,
            stackTrace: trace,
          }),
        ]
      }
      return node
    }
    return super.execute(node, session, claims)
  }

  /**
   * @override Override of {@link Executor.pipe} that
   * provides a simple implementation of piping.
   */
  public pipe(
    node: schema.Node,
    calls: (Method | [Method, Params])[]
  ): Promise<schema.Node> {
    return calls.reduce(async (prev, spec) => {
      const [method, params] = typeof spec === 'string' ? [spec, {}] : spec
      return this.dispatch(method, { '0': await prev, ...params })
    }, Promise.resolve(node))
  }
}
