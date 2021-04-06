import type {Token} from '../src/tokenize'
import {build_groups, Group} from '../src/expressions'
import * as utils from './utils'
import each from 'jest-each'

const expected_groups: [string[], any][] = [
  [['string:foobar'], ['string:foobar']],
  [['(', 'token:foobar', ')'], [{'()': ['token:foobar']}]],
  [['(', 'token:foobar', '+', 'num:123', ')'], [{'()': ['token:foobar', '+', 'num:123']}]],
  [['(', 'token:foobar', 'in', 'token:other', ')'], [{'()': ['token:foobar', 'in', 'token:other']}]],
  [
    ['token:foobar', '[', ']'],
    ['token:foobar', {'[]': []}],
  ],
  [
    ['token:foobar', '[', 'token:other', ']'],
    ['token:foobar', {'[]': ['token:other']}],
  ],
  [['(', '(', 'token:foobar', ')', ')'], [{'()': [{'()': ['token:foobar']}]}]],
  [['(', 'token:foobar', '(', 'token:foobar', ')', ')'], [{'()': ['token:foobar', {'()': ['token:foobar']}]}]],
  [['(', '(', 'token:foobar', ')', 'token:foobar', ')'], [{'()': [{'()': ['token:foobar']}, 'token:foobar']}]],
]

describe('build_groups', () => {
  test('simple group', () => {
    const tokens: Token[] = [{type: '('}, {type: 'token', value: 'abc'}, {type: ')'}]
    expect(build_groups(tokens)).toEqual([
      {
        type: '()',
        members: [
          {
            type: 'token',
            value: 'abc',
          },
        ],
      },
    ])
  })

  test('recursive', () => {
    const tokens: Token[] = ['(', '(', 'token:foobar', ')', ')'].map(utils.compact_as_token)
    expect(build_groups(tokens)).toEqual([
      {type: '()', members: [{type: '()', members: [{type: 'token', value: 'foobar'}]}]},
    ])
  })

  each(expected_groups).test('expected_groups', (tokens_compact, expected_compact) => {
    const tokens: Token[] = tokens_compact.map(utils.compact_as_token)
    const expected: Group = expected_compact.map(utils.compact_as_group)
    expect(build_groups(tokens)).toStrictEqual(expected)
  })

  // test('create expected_groups', () => {
  //   const tokens: [string[], Token[]][] = expected_groups.map(g => [g[0], g[0].map(utils.compact_as_token)])
  //   const new_expected_groups = tokens.map(([g, t]) => [g, build_groups(t).map(utils.group_as_compact)])
  //   console.log(`const expected_groups: [string[], any][] = ${JSON.stringify(new_expected_groups)}`)
  // })
})
