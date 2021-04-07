import type {Token} from '../src/tokenize'
import {build_groups, build_chains, build_functions, build_expression, MixedElement} from '../src/expressions'
import * as utils from './utils'
import each from 'jest-each'

const expected_groups: [string[], any][] = [
  [['string:foobar'], ['string:foobar']],
  [['(', 'id:foobar', ')'], [{'()': [['id:foobar']]}]],
  [['(', 'id:foobar', '+', 'num:123', ')'], [{'()': [['id:foobar', '+', 'num:123']]}]],
  [['(', 'id:foobar', 'in', 'id:other', ')'], [{'()': [['id:foobar', 'in', 'id:other']]}]],
  [
    ['id:foobar', '[', ']'],
    ['id:foobar', {'[]': [[]]}],
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

  each(expected_groups).test('expected_groups', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = expected_compact.map(utils.compact_as_mixed)
    expect(build_groups(tokens)).toStrictEqual(expected)
  })

  // test('create-expected_groups', () => {
  //   const tokens: [string[], Token[]][] = expected_groups.map(g => [g[0], g[0].map(utils.compact_as_token)])
  //   const new_expected_groups = tokens.map(([g, t]) => [g, build_groups(t).map(utils.mixed_as_compact)])
  //   console.log(`const expected_groups: [string[], any][] = ${JSON.stringify(new_expected_groups)}`)
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

  each(expected_chains).test('expected_chains', (tokens_compact, expected_compact) => {
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
  //   console.log(`const expected_expressions: [string[], any][] = ${JSON.stringify(new_expected_expressions)}`)
  // })
})
