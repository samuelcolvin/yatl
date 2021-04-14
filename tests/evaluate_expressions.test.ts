import each from 'jest-each'

import type {Context, Functions} from '../src/expressions/evaluate'
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
  ['true || is_false', true],
  ['no_args()', 42],
  ['one_argument(2)', 4],
  ['one_argument(2 + 3 - 1)', 8],
  ['2|one_argument', 4],
  ['namespace.add(1, 2)', 3],
  ['"bar"|filter_function("foo")', 'foobar'],
  ['1 == 1', true],
  ['1 == 2', false],
  ['"1" == "1"', true],
  ['"1" == 1', false],
  ['a.c.d == a.c.d', true],
  ['a.c.e == a.c.e', true],
  ['a.c.d == a.c.e', false],
  ['a == a', true],
  ['an_array == an_array', true],
  ['an_array == a', false],
  ['(1, 2, 3) == (1, 2, 3)', true],
  ['(1, 2, 3) == (1, 2)', false],
  ['(1, 2, 3) == (1, 3, 2)', false],
]
const text_context: Context = {
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
const test_functions: Functions = {
  no_args: () => 42,
  one_argument: (x: number) => x * 2,
  filter_function: (a: string) => {
    return (b: string) => a + b
  },
  namespace: {
    add: (a: number, b: number) => a + b,
  },
}

describe('evaluate', () => {
  it('maths', () => {
    expect(evaluate('1 + 2', {}, {})).toEqual(3)
  })
  it('lookup', () => {
    expect(evaluate('x', {x: 'foobar'}, {})).toEqual('foobar')
  })
  each(evaluate_expect).test('expected_expressions %s -> %j', (expression, expected_result) => {
    expect(evaluate(expression, text_context, test_functions)).toStrictEqual(expected_result)
  })
})
