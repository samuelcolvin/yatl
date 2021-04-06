import type {Token} from '../src/tokenize'
import {build_groups, Group} from '../src/expressions'
import * as utils from './utils'
import each from 'jest-each'

const expected_groups: [string[], any][] = [
  [['string:foobar'], ['string:foobar']],
  [['b-open', 'token:foobar', 'b-close'], [{brackets: ['token:foobar']}]],
  [['b-open', 'token:foobar', 'in', 'token:other', 'b-close'], [{brackets: ['token:foobar', 'in', 'token:other']}]],
  [
    ['token:foobar', 's-open', 's-close'],
    ['token:foobar', {square: []}],
  ],
  [
    ['token:foobar', 's-open', 'token:other', 's-close'],
    ['token:foobar', {square: ['token:other']}],
  ],
  [['b-open', 'b-open', 'token:foobar', 'b-close', 'b-close'], [{brackets: [{brackets: ['token:foobar']}]}]],
  [
    ['b-open', 'token:foobar', 'b-open', 'token:foobar', 'b-close', 'b-close'],
    [{brackets: ['token:foobar', {brackets: ['token:foobar']}]}],
  ],
  [
    ['b-open', 'b-open', 'token:foobar', 'b-close', 'token:foobar', 'b-close'],
    [{brackets: [{brackets: ['token:foobar']}, 'token:foobar']}],
  ],
]

describe('build_groups', () => {
  test('simple group', () => {
    const tokens: Token[] = [{type: 'b-open'}, {type: 'token', value: 'abc'}, {type: 'b-close'}]
    expect(build_groups(tokens)).toEqual([
      {
        type: 'brackets',
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
    const tokens: Token[] = ['b-open', 'b-open', 'token:foobar', 'b-close', 'b-close'].map(utils.compact_as_token)
    expect(build_groups(tokens)).toEqual([
      {type: 'brackets', members: [{type: 'brackets', members: [{type: 'token', value: 'foobar'}]}]},
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
