import { parseProtocol, generateProtocol } from "./util";

test('generate and parse protocol header', () => {
  expect(parseProtocol(generateProtocol('an-id'))).toEqual({id: 'an-id', jwt: undefined})
  expect(parseProtocol(generateProtocol('an-id', 'a-jwt'))).toEqual({id: 'an-id', jwt: 'a-jwt'})
})
