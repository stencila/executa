import { Method } from './Executor'
import { Worker } from './Worker'
import { schema } from '..'
import { CapabilityError } from './errors'

const worker = new Worker()

describe('select', () => {
  test('select from primitives', async () => {
    expect(await worker.select(false, '0')).toBeUndefined()
    expect(await worker.select(1, 0)).toBeUndefined()
    expect(await worker.select('a', [])).toBe('a')
    expect(await worker.select('a', '/a/b/')).toBeUndefined()
  })

  test('select from array', async () => {
    const array1 = ['a', 'b', 'c']
    expect(await worker.select(array1, '0')).toBe('a')
    expect(await worker.select(array1, '1')).toBe('b')
    expect(await worker.select(array1, [2])).toBe('c')
    expect(await worker.select(array1, [3])).toBeUndefined()
  })

  test('select from object', async () => {
    const object1 = { a: 1, b: { a: 0 }, c: [1, 2, 3] }
    expect(await worker.select(object1, 'a')).toBe(1)
    expect(await worker.select(object1, 'b/a')).toBe(0)
    expect(await worker.select(object1, 'c/1')).toBe(2)
    expect(await worker.select(object1, 'c/1/2')).toBe(undefined)
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
          [Method.select, {pointer: 'output'}],
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
    ).rejects.toThrow(new CapabilityError(Method.encode))
  })
})
