import each from 'jest-each'

import tokenize, {Token} from '../src/expressions/tokenize'
import * as utils from './utils'

const expected_tokens: [string, string[]][] = [
  ['"foobar"', ['str:foobar']],
  ["'foobar'", ['str:foobar']],
  ["'foo\"bar'", ['str:foo"bar']],
  ['bang', ['symbol:bang']],
  ['ba_ng', ['symbol:ba_ng']],
  ['in', ['in']],
  ['and', ['&&']],
  ['abc == 1', ['symbol:abc', '==', 'num:1']],
  ['abc==1', ['symbol:abc', '==', 'num:1']],
  ['abc!= (1, 2, 3)', ['symbol:abc', '!=', '(', 'num:1', ',', 'num:2', ',', 'num:3', ')']],
  ['12 in apple', ['num:12', 'in', 'symbol:apple']],
  ['x.y.z', ['symbol:x', '.', 'symbol:y', '.', 'symbol:z']],
  ['x.?y', ['symbol:x', '.?', 'symbol:y']],
  ['x == 4', ['symbol:x', '==', 'num:4']],
  ['x in y', ['symbol:x', 'in', 'symbol:y']],
  ['(a, b) in y', ['(', 'symbol:a', ',', 'symbol:b', ')', 'in', 'symbol:y']],
  ['x + 4', ['symbol:x', '+', 'num:4']],
  ['(1 + 2) / 2', ['(', 'num:1', '+', 'num:2', ')', '/', 'num:2']],
  ['thing|func', ['symbol:thing', '|', 'symbol:func']],
  ['whatever[1]', ['symbol:whatever', '[', 'num:1', ']']],
  ['true', ['true']],
  ['True', ['true']],
]

describe('tokenize', () => {
  test('simple equals expression', () => {
    const tokens: Token[] = [{type: 'symbol', value: 'abc'}, {type: '=='}, {type: 'num', value: 1}]
    expect(tokenize('abc == 1')).toEqual(tokens)
    expect(tokenize('abc==1')).toEqual(tokens)
  })

  each(expected_tokens).test('expected_tokens %s', (expression, expected_compact) => {
    const expected: Token[] = expected_compact.map(utils.compact_as_token)
    expect(tokenize(expression)).toStrictEqual(expected)
  })

  // test('create expected_tokens', () => {
  //   const new_expected_tokens = expected_tokens.map(([e,]) => [e, tokenize(e).map(utils.token_as_compact)])
  //   console.log('const expected_tokens: [string, string[]][] = %j', new_expected_tokens)
  // })
})
