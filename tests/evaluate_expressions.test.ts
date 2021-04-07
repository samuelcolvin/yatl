import each from 'jest-each'

import {evaluate} from '../src/expressions'

const evaluate_expect: [string, any][] = [
  ['a.b', 'b-value'],
  ['a["b"]', 'b-value'],
  ['a[b_value]', 'b-value'],
  ['a.c.d', 'd-value'],
  ['a.c.e', {f: 'f-value'}],
  ['a.?x', undefined],
  ['a.?x.?q', undefined],
  ['an_array[0]', 'first-element'],
  ['an_array[1]', 'second-element'],
  ['an_array[one]', 'second-element'],
  ['an_array[2].snap', 'snap-value'],
  ['an_array[2]', {snap: 'snap-value'}],
  ['2 + 1', 3],
  ['1 - 2', -1],
  ['2 - 1', 1],
  ['2 + - 1', 1],
  ['1 + (1 + 2)', 4],
  ['2 * (1 + 2)', 6],
  ['4 / (1 + 1)', 2],
  ['(1, 2, one)', [1, 2, 1]],
  ['is_false', false],
  ['is_true', true],
  ['is_true and is_false', false],
  ['is_true or is_false', true],
  ['is_true || is_false', true],
]
const text_context = {
  a: {
    b: 'b-value',
    c: {
      d: 'd-value',
      e: {f: 'f-value'},
    },
  },
  b_value: 'b',
  an_array: ['first-element', 'second-element', {snap: 'snap-value'}],
  one: 1,
  an_int: 123,
  a_float: 12.5,
  is_false: false,
  is_true: true,
}

describe('evaluate', () => {
  it('maths', () => {
    expect(evaluate('1 + 2', {}, {})).toEqual(3)
  })
  it('lookup', () => {
    expect(evaluate('x', {x: 'foobar'}, {})).toEqual('foobar')
  })
  each(evaluate_expect).test('expected_expressions %s -> %j', (expression, expected_result) => {
    expect(evaluate(expression, text_context, {})).toStrictEqual(expected_result)
  })
})
