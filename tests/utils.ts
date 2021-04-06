import type {Token, TokenType} from '../src/tokenize'
import type {Group} from '../src/expressions'

export const token_as_compact = (t: Token): string => (typeof t.value == 'string' ? `${t.type}:${t.value}` : t.type)

export function compact_as_token(s: string): Token {
  if (s.includes(':')) {
    const [type, value] = s.split(':', 2)
    return {type: type as TokenType, value}
  } else {
    return {type: s as TokenType}
  }
}

export function group_as_compact(g: Group | Token): string | Record<string, any> {
  if ('members' in g) {
    return {[g.type]: g.members.map(group_as_compact)}
  } else {
    return token_as_compact(g)
  }
}
export function compact_as_group(s: string | Record<string, any>): Group | Token {
  if (typeof s == 'string') {
    return compact_as_token(s)
  } else {
    const [type, members] = Object.entries(s)[0]
    return {
      type: type as any,
      members: members.map(compact_as_group),
    }
  }
}
