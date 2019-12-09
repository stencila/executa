import { parseProtocol, generateProtocol } from './util'
import { generate } from '../base/uid'

test('generate and parse protocol header', () => {
  const id = generate('ws')
  expect(parseProtocol(generateProtocol(id))).toEqual({
    id,
    jwt: undefined
  })
  expect(parseProtocol(generateProtocol(id, 'a-jwt'))).toEqual({
    id,
    jwt: 'a-jwt'
  })
})
