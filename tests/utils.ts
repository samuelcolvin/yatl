import type {Token, TokenType} from '../src/tokenize'
import type {MixedElement} from '../src/expressions'

export const token_as_compact = (t: Token): string => (typeof t.value == 'string' ? `${t.type}:${t.value}` : t.type)

export function compact_as_token(s: string): Token {
  if (s.includes(':')) {
    const [type, value] = s.split(':', 2)
    return {type: type as TokenType, value}
  } else {
    return {type: s as TokenType}
  }
}

export function mixed_as_compact(g: MixedElement): string | Record<string, any> {
  if (g.type == 'group') {
    return {[g.subtype]: g.members.map(mixed_as_compact)}
  } else if (g.type == 'var') {
    if (g.chain.length) {
      return {[`var:${g.token}`]: g.chain.map(c => c.op + (c.type == 'string' ? c.lookup : `[${c.lookup}]`)).join('')}
    } else {
      return `var:${g.token}`
    }
  } else {
    return token_as_compact(g)
  }
}

export function compact_as_mixed(s: string | Record<string, any>): MixedElement {
  if (typeof s == 'string') {
    if (s.startsWith('var:')) {
      return {
        type: 'var',
        token: s.substr(4),
        chain: [],
      }
    } else {
      return compact_as_token(s)
    }
  } else {
    const [key, value] = Object.entries(s)[0]
    if (key == '()' || key == '[]') {
      return {
        type: 'group',
        subtype: key,
        members: value.map(compact_as_mixed),
      }
    } else {
      let chain = []
      if (value) {
        chain = value
          .substr(1)
          .split('.')
          .map((lookup: string) => {
            let op = '.'
            if (lookup.startsWith('?')) {
              op = '.?'
              lookup = lookup.substr(1)
            }
            let type = 'string'
            if (lookup.startsWith('[')) {
              type = 'token'
              lookup = lookup.substr(1, lookup.length - 2)
            }
            return {op, type, lookup}
          })
      }
      return {
        type: 'var',
        token: key.split(':', 2)[1],
        chain,
      }
    }
  }
}
