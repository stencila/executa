import { parseProtocol, generateProtocol } from './util'

test('generate and parse protocol header', () => {
  expect(parseProtocol(generateProtocol('some-id'))).toEqual({
    id: 'some-id',
    jwt: undefined
  })
  expect(parseProtocol(generateProtocol('another-id', 'a-jwt'))).toEqual({
    id: 'another-id',
    jwt: 'a-jwt'
  })
})
