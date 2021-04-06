import tokenize, {Token} from '../src/tokenize'
import * as utils from './utils'
import each from 'jest-each'

const expected_tokens: [string, string[]][] = [
  ['"foobar"', ['string:foobar']],
  ["'foobar'", ['string:foobar']],
  ["'foo\"bar'", ['string:foo"bar']],
  ['bang', ['token:bang']],
  ['ba_ng', ['token:ba_ng']],
  ['in', ['in']],
  ['and', ['and']],
  ['abc == 1', ['token:abc', 'equals', 'num:1']],
  ['abc==1', ['token:abc', 'equals', 'num:1']],
  ['12 in apple', ['num:12', 'in', 'token:apple']],
  ['x.y.z', ['token:x', 'chain', 'token:y', 'chain', 'token:z']],
  ['x.?y', ['token:x', 'chain-op', 'token:y']],
  ['x == 4', ['token:x', 'equals', 'num:4']],
  ['x in y', ['token:x', 'in', 'token:y']],
  ['x in y', ['token:x', 'in', 'token:y']],
  ['(a, b) in y', ['b-open', 'token:a', 'comma', 'token:b', 'b-close', 'in', 'token:y']],
  ['x + 4', ['token:x', 'add', 'num:4']],
  ['(1 + 2) / 2', ['b-open', 'num:1', 'add', 'num:2', 'b-close', 'dev', 'num:2']],
  ['thing|func', ['token:thing', 'pipe', 'token:func']],
  ['whatever[1]', ['token:whatever', 's-open', 'num:1', 's-close']],
]

describe('tokenize', () => {
  test('simple equals expression', () => {
    const tokens: Token[] = [{type: 'token', value: 'abc'}, {type: 'equals'}, {type: 'num', value: '1'}]
    expect(tokenize('abc == 1')).toEqual(tokens)
    expect(tokenize('abc==1')).toEqual(tokens)
  })

  each(expected_tokens).test('expected_tokens', (expression, expected_compact) => {
    const expected: Token[] = expected_compact.map(utils.compact_as_token)
    expect(tokenize(expression)).toStrictEqual(expected)
  })

  // test('create expected_tokens', () => {
  //   const new_expected_tokens = expected_tokens.map(e => [e[0], tokenize(e[0]).map(utils.token_as_compact)])
  //   console.log(`const expected_tokens: [string, string[]][] = ${JSON.stringify(new_expected_tokens)}`)
  // })
})
