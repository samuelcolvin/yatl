import each from 'jest-each'

import type {Token} from '../src/expressions/tokenize'
import build_expression, {build_groups, build_chains, build_functions, MixedElement} from '../src/expressions/build'
import {build_clause} from '../src/expressions'

import * as utils from './utils'

const expected_groups: [string[], any][] = [
  [['str:foobar'], ['str:foobar']],
  [['(', 'symbol:foobar', ')'], [{'()': [['symbol:foobar']]}]],
  [['(', 'symbol:foobar', '+', 'num:123', ')'], [{'()': [['symbol:foobar', '+', 'num:123']]}]],
  [['(', 'symbol:foobar', 'in', 'symbol:other', ')'], [{'()': [['symbol:foobar', 'in', 'symbol:other']]}]],
  [
    ['symbol:foobar', '[', ']'],
    ['symbol:foobar', {'[]': []}],
  ],
  [
    ['symbol:foobar', '[', 'symbol:other', ']'],
    ['symbol:foobar', {'[]': [['symbol:other']]}],
  ],
  [['(', '(', 'symbol:foobar', ')', ')'], [{'()': [[{'()': [['symbol:foobar']]}]]}]],
  [['(', 'symbol:foobar', '(', 'symbol:foobar', ')', ')'], [{'()': [['symbol:foobar', {'()': [['symbol:foobar']]}]]}]],
  [['(', '(', 'symbol:foobar', ')', 'symbol:foobar', ')'], [{'()': [[{'()': [['symbol:foobar']]}, 'symbol:foobar']]}]],
  [
    ['symbol:foobar', '(', 'symbol:a', ',', 'symbol:b', ')'],
    ['symbol:foobar', {'()': [['symbol:a'], ['symbol:b']]}],
  ],
  [
    ['symbol:foobar', '(', 'symbol:a', '+', 'symbol:c', ',', 'symbol:b', ')'],
    ['symbol:foobar', {'()': [['symbol:a', '+', 'symbol:c'], ['symbol:b']]}],
  ],
  [
    ['symbol:foobar', '(', 'symbol:a', '+', 'symbol:c', ',', 'symbol:b', ')'],
    ['symbol:foobar', {'()': [['symbol:a', '+', 'symbol:c'], ['symbol:b']]}],
  ],
  [
    ['symbol:foobar', '(', 'symbol:a', '-', '(', 'symbol:a', '+', 'symbol:c', ')', ')'],
    ['symbol:foobar', {'()': [['symbol:a', '-', {'()': [['symbol:a', '+', 'symbol:c']]}]]}],
  ],
  [
    ['symbol:foobar', '(', 'symbol:a', '(', 'symbol:a', ',', 'symbol:c', ')', ')'],
    ['symbol:foobar', {'()': [['symbol:a', {'()': [['symbol:a'], ['symbol:c']]}]]}],
  ],
  [['(', ')'], [{'()': []}]],
]

describe('build_groups', () => {
  test('simple-group', () => {
    const tokens: Token[] = [{type: '('}, {type: 'symbol', value: 'abc'}, {type: ')'}]
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [[{type: 'symbol', value: 'abc'}]],
      },
    ])
  })

  test('recursive', () => {
    const tokens: Token[] = ['(', '(', 'symbol:foobar', ')', ')'].map(utils.compact_as_token)
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [[{type: 'group', subtype: '()', args: [[{type: 'symbol', value: 'foobar'}]]}]],
      },
    ])
  })

  each(expected_groups).test('expected_groups %j', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = expected_compact.map(utils.compact_as_mixed)
    expect(build_groups(tokens)).toStrictEqual(expected)
  })

  // test('create-expected_groups', () => {
  //   const tokens: [string[], Token[]][] = expected_groups.map(([g,]) => [g, g.map(utils.compact_as_token)])
  //   const new_expected_groups = tokens.map(([g, t]) => [g, build_groups(t).map(utils.mixed_as_compact)])
  //   console.log('const expected_groups: [string[], any][] = %j', new_expected_groups)
  // })
})

const expected_chains: [any[], any][] = [
  [['symbol:foo'], ['var:foo']],
  [
    ['symbol:foo', 'num:1'],
    ['var:foo', 'num:1'],
  ],
  [
    ['symbol:foo', '.', 'symbol:bar', 'num:1'],
    [{'var:foo': '.bar'}, 'num:1'],
  ],
  [['symbol:foo', '.', 'symbol:bar', '.?', 'symbol:spam'], [{'var:foo': '.bar.?spam'}]],
  [['symbol:foo', {'[]': [['symbol:other']]}], [{'var:foo': '.[other]'}]],
  [['symbol:foo', {'[]': [['str:foobar']]}], [{'var:foo': '.foobar'}]],
  [['symbol:foo', '.', 'symbol:bar', {'[]': [['symbol:other']]}], [{'var:foo': '.bar.[other]'}]],
  [['symbol:foo', '.', {'[]': [['symbol:other']]}], [{'var:foo': '.[other]'}]],
  [['symbol:foo', '.?', {'[]': [['symbol:other']]}], [{'var:foo': '.?[other]'}]],
  [[{'()': [['symbol:foobar']]}], [{'()': [['var:foobar']]}]],
  [[{'()': [['num:123']]}], [{'()': [['num:123']]}]],
]

describe('build_chains', () => {
  test('simple-chain', () => {
    const tokens: Token[] = [{type: 'symbol', value: 'abc'}, {type: '.'}, {type: 'symbol', value: 'x'}]
    expect(build_chains(tokens)).toEqual([{type: 'var', symbol: 'abc', chain: [{op: '.', lookup: 'x', type: 'str'}]}])
  })

  each(expected_chains).test('expected_chains %j', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_mixed)
    const expected = expected_compact.map(utils.compact_as_mixed)
    // console.log('got %o', build_chains(tokens))
    // console.log('expected %o', expected)
    expect(build_chains(tokens)).toStrictEqual(expected)
  })
})

describe('build_functions', () => {
  test('simple-function', () => {
    const tokens: MixedElement[] = [
      {type: 'var', symbol: 'abc', chain: []},
      {type: 'group', subtype: '()', args: [[{type: 'var', symbol: 'def', chain: []}]]},
    ]
    expect(build_functions(tokens)).toEqual([
      {
        type: 'func',
        temp: true,
        var: {type: 'var', symbol: 'abc', chain: []},
        args: [[{type: 'var', symbol: 'def', chain: []}]],
      },
    ])
  })
  // TODO parameterised tests for build_functions
})

const expected_expressions: [string[], any][] = [
  [['symbol:a', '+', 'symbol:b', '+', 'str:c'], {'op:+': ['var:a', 'var:b', 'str:c']}],
  [['symbol:a', '+', 'symbol:b', '-', 'str:c'], {'op:-': [{'op:+': ['var:a', 'var:b']}, 'str:c']}],
  [['symbol:foobar', '(', 'symbol:spam', ')'], {func: 'var:foobar', args: ['var:spam']}],
]

describe('build_expression', () => {
  test('simple_add', () => {
    const tokens: Token[] = ['str:foobar', '+', 'num:123'].map(utils.compact_as_token)
    // console.log(JSON.stringify(build_expression(tokens), null, 2))
    expect(build_expression(tokens)).toEqual({
      type: 'operator',
      operator: '+',
      args: [
        {type: 'str', value: 'foobar'},
        {type: 'num', value: 123},
      ],
    })
  })

  each(expected_expressions).test('expected_expressions %j -> %j', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = utils.compact_as_clause(expected_compact)
    expect(build_expression(tokens)).toStrictEqual(expected)
  })

  // test('create-expected_expressions', () => {
  //   const tokens: [string[], Token[]][] = expected_expressions.map(([g,]) => [g, g.map(utils.compact_as_token)])
  //   const new_expected_expressions = tokens.map(([g, t]) => [g, utils.clause_as_compact(build_expression(t))])
  //   console.log('const expected_expressions: [string[], any][] = %j', new_expected_expressions)
  // })
})

const expected_e2e: [string, any][] = [
  ['"foobar"', 'str:foobar'],
  ['bang', 'var:bang'],
  ['abc == 1', {'op:==': ['var:abc', 'num:1']}],
  ['abc != (1, 2, 3)', {'op:!=': ['var:abc', ['num:1', 'num:2', 'num:3']]}],
  ['12 in apple', {'op:in': ['num:12', 'var:apple']}],
  ['x.y.z * a["x"]', {'op:*': [{'var:x': '.y.z'}, {'var:a': '.x'}]}],
  ['(a, b) in y', {'op:in': [['var:a', 'var:b'], 'var:y']}],
  ['x + 4', {'op:+': ['var:x', 'num:4']}],
  ['(1 + 2) / 2', {'op:/': [{'op:+': ['num:1', 'num:2']}, 'num:2']}],
  ['thing|spam', {'op:|': ['var:thing', 'var:spam']}],
  ['foo(1, 2)', {func: 'var:foo', args: ['num:1', 'num:2']}],
  ['1 + foo(1, 2)', {'op:+': ['num:1', {func: 'var:foo', args: ['num:1', 'num:2']}]}],
  ['foo(1 + 2, x.?[y])', {func: 'var:foo', args: [{'op:+': ['num:1', 'num:2']}, {'var:x': '.?[y]'}]}],

  ['foo()', {func: 'var:foo', args: []}],
  ['thing|spam|another()', {'op:|': ['var:thing', 'var:spam', {func: 'var:another', args: []}]}],
  ['whatever[1]', {'var:whatever': '.num:1'}],
  ['"bar"|filter_function("foo")', {'op:|': ['str:bar', {func: 'var:filter_function', args: ['str:foo']}]}],

  ['!modified', {'mod:!': 'var:modified'}],
  ['!!modified', {'mod:!': {'mod:!': 'var:modified'}}],
  ['!!!modified', {'mod:!': {'mod:!': {'mod:!': 'var:modified'}}}],
  ['-modified', {'mod:-': 'var:modified'}],
  ['--modified', {'mod:-': {'mod:-': 'var:modified'}}],
  ['!modified()', {'mod:!': {func: 'var:modified', args: []}}],
  ['!foo|bar', {'mod:!': {'op:|': ['var:foo', 'var:bar']}}],
  ['a + !modified', {'op:+': ['var:a', {'mod:!': 'var:modified'}]}],
  ['a + -modified', {'op:+': ['var:a', {'mod:-': 'var:modified'}]}],
  ['-modified(a, b, !c)', {'mod:-': {func: 'var:modified', args: ['var:a', 'var:b', {'mod:!': 'var:c'}]}}],
]

describe('build-e2e', () => {
  test('simple_build', () => {
    const expression = '1 + 3 || foobar(1, spanner)'
    // console.log(JSON.stringify(build(expression), null, 2))
    expect(build_clause(expression)).toEqual({
      type: 'operator',
      operator: '||',
      args: [
        {
          type: 'operator',
          operator: '+',
          args: [
            {type: 'num', value: 1},
            {type: 'num', value: 3},
          ],
        },
        {
          type: 'func',
          var: {type: 'var', symbol: 'foobar', chain: []},
          args: [
            {type: 'num', value: 1},
            {type: 'var', symbol: 'spanner', chain: []},
          ],
        },
      ],
    })
  })

  each(expected_e2e).test('expected_e2e %s -> %j', (expression, expected_compact) => {
    const clause = build_clause(expression)
    // console.log('full clause: %o', clause)
    // console.log('compact clause: %j', utils.clause_as_compact(clause))
    const expected = utils.compact_as_clause(expected_compact)
    expect(clause).toStrictEqual(expected)
  })

  // test('create-expected_e2e', () => {
  //   const new_expected_e2e = expected_e2e.map(([g,]) => [g, utils.clause_as_compact(build(g))])
  //   console.log('const expected_e2e: [string, any][] = %j', new_expected_e2e)
  // })
})
