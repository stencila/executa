import { Method } from './Executor'
import { Worker } from './Worker'
import { schema } from '..'
import { CapabilityError } from './errors'
import { JSONSchema7 } from 'json-schema'

const worker = new Worker()

describe('query', () => {
  test('json-pointer: primitives', async () => {
    expect(await worker.query(false, '0', 'json-pointer')).toBeUndefined()
    expect(await worker.query(1, '0', 'json-pointer')).toBeUndefined()
    expect(await worker.query('a', '/a/b/', 'json-pointer')).toBeUndefined()
  })

  test('json-pointer: array', async () => {
    const array1 = ['a', 'b', 'c']
    expect(await worker.query(array1, '0', 'json-pointer')).toBe('a')
    expect(await worker.query(array1, '1', 'json-pointer')).toBe('b')
    expect(await worker.query(array1, '3', 'json-pointer')).toBeUndefined()
  })

  test('json-pointer: object', async () => {
    const object1 = { a: 1, b: { a: 0 }, c: [1, 2, 3] }
    expect(await worker.query(object1, 'a', 'json-pointer')).toBe(1)
    expect(await worker.query(object1, 'b/a', 'json-pointer')).toBe(0)
    expect(await worker.query(object1, 'c/1', 'json-pointer')).toBe(2)
    expect(await worker.query(object1, 'c/1/2', 'json-pointer')).toBe(undefined)
  })

  test('jmes-path: array', async () => {
    const array1 = ['a', 'b', 'c']
    expect(await worker.query(array1, '[0]')).toBe('a')
    expect(await worker.query(array1, '[1]')).toBe('b')
  })

  test('jmes-path: object', async () => {
    const object1 = { a: 1, b: { a: 0 }, c: [1, 2, 3] }
    expect(await worker.query(object1, 'a')).toBe(1)
    expect(await worker.query(object1, 'b.a')).toBe(0)
    expect(await worker.query(object1, 'c[1]')).toBe(2)
    expect(await worker.query(object1, 'c[1][2]')).toBe(null)
  })

  test('jmes-path: query capabilities', async () => {
    // Simulates getting a list of programming languages
    // that can be `executed` and formats that can be
    // encoded to.
    // See https://github.com/stencila/executa/issues/45

    const pyla: JSONSchema7 = {
      required: ['node'],
      properties: {
        node: {
          required: ['type', 'programmingLanguage'],
          properties: {
            type: {
              const: 'CodeChunk'
            },
            programmingLanguage: {
              // Langs specified as an enum of alternatives
              enum: ['py', 'python']
            }
          }
        }
      }
    }

    // For brevity, the following omit props not
    // needed for this test

    const rasta: JSONSchema7 = {
      properties: {
        node: {
          properties: {
            programmingLanguage: {
              // Single lang specified as a const
              const: 'r'
            }
          }
        }
      }
    }

    const jesta: JSONSchema7 = {
      properties: {
        node: {
          // Lazy programmer didn't specify langs
        }
      }
    }

    const encoda: JSONSchema7 = {
      properties: {
        format: {
          enum: ['rmd', 'docx', 'pdf']
        }
      }
    }

    const workerEncode: JSONSchema7 = {
      properties: {
        format: {
          enum: ['json']
        }
      }
    }

    const manifest = {
      capabilities: {
        execute: [pyla, rasta, jesta],
        encode: [workerEncode, encoda]
      }
    }

    expect(
      await worker.query(
        manifest,
        'capabilities.execute[*].properties.node.properties.programmingLanguage.[const, enum][]'
      )
    ).toEqual([['py', 'python'], 'r'])

    // Can slice off the first item from enums...
    expect(
      await worker.query(
        manifest,
        'capabilities.execute[*].properties.node.properties.programmingLanguage.[const, enum[0]][]'
      )
    ).toEqual(['py', 'r'])

    // Get a sorted list of all the supported formats for encoding
    expect(
      await worker.query(
        manifest,
        'capabilities.encode[*].properties.format.[const, enum][][] | sort(@)'
      )
    ).toEqual(['docx', 'json', 'pdf', 'rmd'])
  })

  test('jmes-path: query a document metadata', async () => {
    /**
     * Simulates querying of a document. This could be made
     * available via the command line e.g.
     *
     * `executa query authors[*].affiliations[*].name article.docx`
     */
    const article = schema.article(
      [
        schema.person({
          givenNames: ['Jane'],
          affiliations: [
            schema.organization({
              name: 'Acme Corp'
            })
          ]
        }),
        schema.person({
          givenNames: ['John'],
          affiliations: [
            schema.organization({
              name: 'Example University'
            })
          ]
        })
      ],
      'On treating documents as a database'
    )

    expect(
      await worker.query(article, 'authors[*].affiliations[*].name[]')
    ).toEqual(['Acme Corp', 'Example University'])
  })
})

describe('execute', () => {
  const ex = async (text: string) => {
    return worker.execute(
      schema.codeExpression(text, { programmingLanguage: 'js' })
    )
  }

  test('outputs', async () => {
    const output = async (text: string) => (await ex(text)).output
    expect(await output('')).toBeUndefined()
    expect(await output('1')).toBe(1)
    expect(await output('6 * 7')).toBe(42)
    expect(await output('{a: 1, b: 3 - 1}')).toEqual({ a: 1, b: 2 })
  })

  test('errors', async () => {
    const error = async (text: string) => (await ex(text)).errors
    expect(await error('')).toBeUndefined()
    expect(await error('6 * 7')).toBeUndefined()
    expect(await error('{')).toEqual([
      schema.codeError('SyntaxError', {
        message: 'Unexpected token )'
      })
    ])
    expect(await error('foo')).toEqual([
      schema.codeError('ReferenceError', {
        message: 'foo is not defined'
      })
    ])
  })
})

// prettier-ignore
describe('pipe', () => {
  test('single call, no params', async () => {
    // This is unlikely to ever be used for real
    // (since you could just call manifest directly)
    expect(
      await worker.pipe(null, [Method.manifest])
    ).toEqual(
      await worker.manifest()
    )
    expect(
      await worker.pipe(null, [[Method.manifest, {}]])
    ).toEqual(
      await worker.manifest()
    )
  })

  test('single call, one optional param', async () => {
    // This is only likely to be used if the pipe call is
    // generated (since you could just call decode directly)
    const content = '{"type":"CodeExpression","text":"6 * 7"}'
    expect(
      await worker.pipe(content, [[Method.decode, {format: 'json'}]])
    ).toEqual(
      await worker.decode(content, 'json')
    )
  })

  test('two calls, both with optional params', async () => {
    const content = '{"type":"CodeChunk","text":"a = 6 * 7"}'
    expect(
      await worker.pipe(
        content,
        [
          [Method.decode, {format: 'json'}],
          [Method.encode, {format: 'json'}]
        ]
      )
    ).toEqual(
      content
    )
  })

  test('execute, select, encode', async () => {
    /**
     * This simulates what a browser based client may want to have
     * a server based executor do: execute a code expression and
     * then encode it's `outputs` as HTML (except, due to the
     * limitations of `Worker`, here we used JSON).
     */
    const node = {
      type: 'CodeExpression',
      programmingLanguage: 'js',
      text: '{answer: 6 * 7}'
    }
    expect(
      await worker.pipe(
        node,
        [
          Method.execute,
          [Method.query, {query: 'output'}],
          [Method.encode, {format: 'json'}]
        ]
      )
    ).toEqual(
      '{"answer":42}'
    )
  })

  test('capability error', async () => {
    /**
     * If the pipeline includes something the
     * worker can't do then it will throw a capability error
     */
    await expect(
      worker.pipe(
        '{}',
        [
          [Method.decode, {format: 'json'}],
          [Method.encode, {format: 'pdf'}],
        ]
      )
    ).rejects.toThrow(CapabilityError)
  })
})
