import each from 'jest-each'

import tokenize, {Token} from '../src/expressions/tokenize'
import * as utils from './utils'

const expected_tokens: [string, string[]][] = [
  ['"foobar"', ['string:foobar']],
  ["'foobar'", ['string:foobar']],
  ["'foo\"bar'", ['string:foo"bar']],
  ['bang', ['id:bang']],
  ['ba_ng', ['id:ba_ng']],
  ['in', ['in']],
  ['and', ['&&']],
  ['abc == 1', ['id:abc', '==', 'num:1']],
  ['abc==1', ['id:abc', '==', 'num:1']],
  ['abc!= (1, 2, 3)', ['id:abc', '!=', '(', 'num:1', ',', 'num:2', ',', 'num:3', ')']],
  ['12 in apple', ['num:12', 'in', 'id:apple']],
  ['x.y.z', ['id:x', '.', 'id:y', '.', 'id:z']],
  ['x.?y', ['id:x', '.?', 'id:y']],
  ['x == 4', ['id:x', '==', 'num:4']],
  ['x in y', ['id:x', 'in', 'id:y']],
  ['(a, b) in y', ['(', 'id:a', ',', 'id:b', ')', 'in', 'id:y']],
  ['x + 4', ['id:x', '+', 'num:4']],
  ['(1 + 2) / 2', ['(', 'num:1', '+', 'num:2', ')', '/', 'num:2']],
  ['thing|func', ['id:thing', '|', 'id:func']],
  ['whatever[1]', ['id:whatever', '[', 'num:1', ']']],
]

describe('tokenize', () => {
  test('simple equals expression', () => {
    const tokens: Token[] = [{type: 'id', value: 'abc'}, {type: '=='}, {type: 'num', value: 1}]
    expect(tokenize('abc == 1')).toEqual(tokens)
    expect(tokenize('abc==1')).toEqual(tokens)
  })

  each(expected_tokens).test('expected_tokens %s', (expression, expected_compact) => {
    const expected: Token[] = expected_compact.map(utils.compact_as_token)
    expect(tokenize(expression)).toStrictEqual(expected)
  })

  // test('create expected_tokens', () => {
  //   const new_expected_tokens = expected_tokens.map(e => [e[0], tokenize(e[0]).map(utils.token_as_compact)])
  //   console.log('const expected_tokens: [string, string[]][] = %j', new_expected_tokens)
  // })
})
