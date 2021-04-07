import each from 'jest-each'

import type {Token} from '../src/expressions/tokenize'
import build_expression, {build_groups, build_chains, build_functions, MixedElement} from '../src/expressions/build'
import {build} from '../src/expressions'

import * as utils from './utils'

const expected_groups: [string[], any][] = [
  [['string:foobar'], ['string:foobar']],
  [['(', 'id:foobar', ')'], [{'()': [['id:foobar']]}]],
  [['(', 'id:foobar', '+', 'num:123', ')'], [{'()': [['id:foobar', '+', 'num:123']]}]],
  [['(', 'id:foobar', 'in', 'id:other', ')'], [{'()': [['id:foobar', 'in', 'id:other']]}]],
  [
    ['id:foobar', '[', ']'],
    ['id:foobar', {'[]': []}],
  ],
  [
    ['id:foobar', '[', 'id:other', ']'],
    ['id:foobar', {'[]': [['id:other']]}],
  ],
  [['(', '(', 'id:foobar', ')', ')'], [{'()': [[{'()': [['id:foobar']]}]]}]],
  [['(', 'id:foobar', '(', 'id:foobar', ')', ')'], [{'()': [['id:foobar', {'()': [['id:foobar']]}]]}]],
  [['(', '(', 'id:foobar', ')', 'id:foobar', ')'], [{'()': [[{'()': [['id:foobar']]}, 'id:foobar']]}]],
  [
    ['id:foobar', '(', 'id:a', ',', 'id:b', ')'],
    ['id:foobar', {'()': [['id:a'], ['id:b']]}],
  ],
  [
    ['id:foobar', '(', 'id:a', '+', 'id:c', ',', 'id:b', ')'],
    ['id:foobar', {'()': [['id:a', '+', 'id:c'], ['id:b']]}],
  ],
  [
    ['id:foobar', '(', 'id:a', '+', 'id:c', ',', 'id:b', ')'],
    ['id:foobar', {'()': [['id:a', '+', 'id:c'], ['id:b']]}],
  ],
  [
    ['id:foobar', '(', 'id:a', '-', '(', 'id:a', '+', 'id:c', ')', ')'],
    ['id:foobar', {'()': [['id:a', '-', {'()': [['id:a', '+', 'id:c']]}]]}],
  ],
  [
    ['id:foobar', '(', 'id:a', '(', 'id:a', ',', 'id:c', ')', ')'],
    ['id:foobar', {'()': [['id:a', {'()': [['id:a'], ['id:c']]}]]}],
  ],
  [['(', ')'], [{'()': []}]],
]

describe('build_groups', () => {
  test('simple-group', () => {
    const tokens: Token[] = [{type: '('}, {type: 'id', value: 'abc'}, {type: ')'}]
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [[{type: 'id', value: 'abc'}]],
      },
    ])
  })

  test('recursive', () => {
    const tokens: Token[] = ['(', '(', 'id:foobar', ')', ')'].map(utils.compact_as_token)
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [[{type: 'group', subtype: '()', args: [[{type: 'id', value: 'foobar'}]]}]],
      },
    ])
  })

  each(expected_groups).test('expected_groups %j', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = expected_compact.map(utils.compact_as_mixed)
    expect(build_groups(tokens)).toStrictEqual(expected)
  })

  // test('create-expected_groups', () => {
  //   const tokens: [string[], Token[]][] = expected_groups.map(g => [g[0], g[0].map(utils.compact_as_token)])
  //   const new_expected_groups = tokens.map(([g, t]) => [g, build_groups(t).map(utils.mixed_as_compact)])
  //   console.log('const expected_groups: [string[], any][] = %j', new_expected_groups)
  // })
})

const expected_chains: [any[], any][] = [
  [['id:foo'], ['var:foo']],
  [
    ['id:foo', 'num:1'],
    ['var:foo', 'num:1'],
  ],
  [
    ['id:foo', '.', 'id:bar', 'num:1'],
    [{'var:foo': '.bar'}, 'num:1'],
  ],
  [['id:foo', '.', 'id:bar', '.?', 'id:spam'], [{'var:foo': '.bar.?spam'}]],
  [['id:foo', {'[]': [['id:other']]}], [{'var:foo': '.[other]'}]],
  [['id:foo', {'[]': [['string:foobar']]}], [{'var:foo': '.foobar'}]],
  [['id:foo', '.', 'id:bar', {'[]': [['id:other']]}], [{'var:foo': '.bar.[other]'}]],
  [['id:foo', '.', {'[]': [['id:other']]}], [{'var:foo': '.[other]'}]],
  [['id:foo', '.?', {'[]': [['id:other']]}], [{'var:foo': '.?[other]'}]],
  [[{'()': [['id:foobar']]}], [{'()': [['var:foobar']]}]],
  [[{'()': [['num:123']]}], [{'()': [['num:123']]}]],
]

describe('build_chains', () => {
  test('simple-chain', () => {
    const tokens: Token[] = [{type: 'id', value: 'abc'}, {type: '.'}, {type: 'id', value: 'x'}]
    expect(build_chains(tokens)).toEqual([{type: 'var', id: 'abc', chain: [{op: '.', lookup: 'x', type: 'string'}]}])
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
      {type: 'var', id: 'abc', chain: []},
      {type: 'group', subtype: '()', args: [[{type: 'id', value: 'x'}]]},
    ]
    expect(build_functions(tokens)).toEqual([
      {
        type: 'func',
        temp: true,
        var: {type: 'var', id: 'abc', chain: []},
        args: [[{type: 'id', value: 'x'}]],
      },
    ])
  })
  // TODO parameterised tests for build_functions
})

const expected_expressions: [string[], any][] = [
  [['id:a', '+', 'id:b', '+', 'string:c'], {'op:+': ['var:a', 'var:b', 'str:c']}],
  [['id:a', '+', 'id:b', '-', 'string:c'], {'op:-': [{'op:+': ['var:a', 'var:b']}, 'str:c']}],
  [['id:foobar', '(', 'id:spam', ')'], {func: 'var:foobar', args: ['var:spam']}],
]

describe('build_expression', () => {
  test('simple_add', () => {
    const tokens: Token[] = ['string:foobar', '+', 'num:123'].map(utils.compact_as_token)
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

  each(expected_expressions).test('expected_expressions', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = utils.compact_as_clause(expected_compact)
    expect(build_expression(tokens)).toStrictEqual(expected)
  })

  // test('create-expected_expressions', () => {
  //   const tokens: [string[], Token[]][] = expected_expressions.map(g => [g[0], g[0].map(utils.compact_as_token)])
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

  ['foo()', {func: 'var:foo', args: []}],
  ['thing|spam|another()', {'op:|': ['var:thing', 'var:spam', {func: 'var:another', args: []}]}],
  ['whatever[1]', {'var:whatever': '.num:1'}],
]

describe('build-e2e', () => {
  test('simple_build', () => {
    const expression = '1 + 3 || foobar(1, spanner)'
    // console.log(JSON.stringify(build(expression), null, 2))
    expect(build(expression)).toEqual({
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
          var: {type: 'var', id: 'foobar', chain: []},
          args: [
            {type: 'num', value: 1},
            {type: 'var', id: 'spanner', chain: []},
          ],
        },
      ],
    })
  })

  each(expected_e2e).test('expected_e2e %s', (expression, expected_compact) => {
    // console.log('expression:', expression)
    const clause = build(expression)
    // console.log('clause: %o', clause)
    const expected = utils.compact_as_clause(expected_compact)
    // console.log('expected: %o', expected)
    expect(clause).toStrictEqual(expected)
  })

  // test('create-expected_e2e', () => {
  //   const new_expected_e2e = expected_e2e.map(g => [g[0], utils.clause_as_compact(build(g[0]))])
  //   console.log('const expected_e2e: [string, any][] = %j', new_expected_e2e)
  // })
})
