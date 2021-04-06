import type {Token} from '../src/tokenize'
import {build_groups, build_chains, build_functions, MixedElement} from '../src/expressions'
import * as utils from './utils'
import each from 'jest-each'

const expected_groups: [string[], any][] = [
  [['string:foobar'], ['string:foobar']],
  [['(', 'token:foobar', ')'], [{'()': [['token:foobar']]}]],
  [['(', 'token:foobar', '+', 'num:123', ')'], [{'()': [['token:foobar', '+', 'num:123']]}]],
  [['(', 'token:foobar', 'in', 'token:other', ')'], [{'()': [['token:foobar', 'in', 'token:other']]}]],
  [
    ['token:foobar', '[', ']'],
    ['token:foobar', {'[]': [[]]}],
  ],
  [
    ['token:foobar', '[', 'token:other', ']'],
    ['token:foobar', {'[]': [['token:other']]}],
  ],
  [['(', '(', 'token:foobar', ')', ')'], [{'()': [[{'()': [['token:foobar']]}]]}]],
  [['(', 'token:foobar', '(', 'token:foobar', ')', ')'], [{'()': [['token:foobar', {'()': [['token:foobar']]}]]}]],
  [['(', '(', 'token:foobar', ')', 'token:foobar', ')'], [{'()': [[{'()': [['token:foobar']]}, 'token:foobar']]}]],
  [
    ['token:foobar', '(', 'token:a', ',', 'token:b', ')'],
    ['token:foobar', {'()': [['token:a'], ['token:b']]}],
  ],
  [
    ['token:foobar', '(', 'token:a', '+', 'token:c', ',', 'token:b', ')'],
    ['token:foobar', {'()': [['token:a', '+', 'token:c'], ['token:b']]}],
  ],
  [
    ['token:foobar', '(', 'token:a', '+', 'token:c', ',', 'token:b', ')'],
    ['token:foobar', {'()': [['token:a', '+', 'token:c'], ['token:b']]}],
  ],
  [
    ['token:foobar', '(', 'token:a', '-', '(', 'token:a', '+', 'token:c', ')', ')'],
    ['token:foobar', {'()': [['token:a', '-', {'()': [['token:a', '+', 'token:c']]}]]}],
  ],
  [
    ['token:foobar', '(', 'token:a', '(', 'token:a', ',', 'token:c', ')', ')'],
    ['token:foobar', {'()': [['token:a', {'()': [['token:a'], ['token:c']]}]]}],
  ],
]

describe('build_groups', () => {
  test('simple-group', () => {
    const tokens: Token[] = [{type: '('}, {type: 'token', value: 'abc'}, {type: ')'}]
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [
          [
            {
              type: 'token',
              value: 'abc',
            },
          ],
        ],
      },
    ])
  })

  test('recursive', () => {
    const tokens: Token[] = ['(', '(', 'token:foobar', ')', ')'].map(utils.compact_as_token)
    expect(build_groups(tokens)).toEqual([
      {
        type: 'group',
        subtype: '()',
        args: [[{type: 'group', subtype: '()', args: [[{type: 'token', value: 'foobar'}]]}]],
      },
    ])
  })

  each(expected_groups).test('expected_groups', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected = expected_compact.map(utils.compact_as_mixed)
    expect(build_groups(tokens)).toStrictEqual(expected)
  })

  // test('create expected_groups', () => {
  //   const tokens: [string[], Token[]][] = expected_groups.map(g => [g[0], g[0].map(utils.compact_as_token)])
  //   const new_expected_groups = tokens.map(([g, t]) => [g, build_groups(t).map(utils.mixed_as_compact)])
  //   console.log(`const expected_groups: [string[], any][] = ${JSON.stringify(new_expected_groups)}`)
  // })
})

const expected_chains: [any[], any][] = [
  [['token:foo'], ['var:foo']],
  [
    ['token:foo', 'num:1'],
    ['var:foo', 'num:1'],
  ],
  [
    ['token:foo', '.', 'token:bar', 'num:1'],
    [{'var:foo': '.bar'}, 'num:1'],
  ],
  [['token:foo', '.', 'token:bar', '.?', 'token:spam'], [{'var:foo': '.bar.?spam'}]],
  [['token:foo', {'[]': [['token:other']]}], [{'var:foo': '.[other]'}]],
  [['token:foo', {'[]': [['string:foobar']]}], [{'var:foo': '.foobar'}]],
  [['token:foo', '.', 'token:bar', {'[]': [['token:other']]}], [{'var:foo': '.bar.[other]'}]],
  [['token:foo', '.', {'[]': [['token:other']]}], [{'var:foo': '.[other]'}]],
  [['token:foo', '.?', {'[]': [['token:other']]}], [{'var:foo': '.?[other]'}]],
  [[{'()': [['token:foobar']]}], [{'()': [['var:foobar']]}]],
  [[{'()': [['num:123']]}], [{'()': [['num:123']]}]],
]

describe('build_chains', () => {
  test('simple-chain', () => {
    const tokens: Token[] = [{type: 'token', value: 'abc'}, {type: '.'}, {type: 'token', value: 'x'}]
    expect(build_chains(tokens)).toEqual([
      {
        type: 'var',
        token: 'abc',
        chain: [
          {
            op: '.',
            lookup: 'x',
            type: 'string',
          },
        ],
      },
    ])
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
      {type: 'var', token: 'abc', chain: []},
      {type: 'group', subtype: '()', args: [[{type: 'token', value: 'x'}]]},
    ]
    expect(build_functions(tokens)).toEqual([
      {
        type: 'func',
        var: {
          type: 'var',
          token: 'abc',
          chain: [],
        },
        args: [
          [
            {
              type: 'token',
              value: 'x',
            },
          ],
        ],
      },
    ])
  })
  // TODO parameterised tests for build_functions
})
