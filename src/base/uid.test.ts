import lolex from 'lolex'
import { epoch, generate, parse } from './uid'

const clock = lolex.install()

beforeEach(() => {
  clock.setSystemTime(epoch)
})

afterEach(() => {
  clock.reset()
})

describe('generate', () => {
  test('structure', () => {
    expect(generate('ab').family).toBe('ab')
    expect(generate('abc').length).toBe(32)
    expect(generate('a').toString()).toMatch(
      /^aa([0-9a-f]{10})([0-9A-Za-z]{20})$/
    )
  })

  test('ordered by time', () => {
    const gen = (): string => generate('ab').toString()

    const id0 = gen()
    expect(id0).toMatch(/^ab0000000000([0-9A-Za-z]{20})$/)

    clock.tick(1)
    const id1 = gen()
    expect(id1).toMatch(/^ab0000000001([0-9A-Za-z]{20})$/)
    expect(id1 > id0).toBe(true)

    clock.tick(9)
    const id2 = gen()
    expect(id2).toMatch(/^ab000000000a([0-9A-Za-z]{20})$/)
    expect(id2 > id1).toBe(true)

    clock.tick(16)
    const id3 = gen()
    expect(id3).toMatch(/^ab000000001a([0-9A-Za-z]{20})$/)
    expect(id3 > id1).toBe(true)
  })
})

describe('parse', () => {
  test('ok', () => {
    expect(parse('aa0000000011111111111111111111')).toEqual({
      family: 'aa',
      time: new Date(epoch),
      rand: '11111111111111111111',
    })
  })

  test('bad', () => {
    expect(parse('')).toBeUndefined()
    expect(parse('a')).toBeUndefined()
    expect(parse('aa')).toBeUndefined()
    expect(parse('aa01')).toBeUndefined()
  })
})
