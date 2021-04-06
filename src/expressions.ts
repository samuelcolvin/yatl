import tokenize, {Token, TokenType} from './tokenize'

type GroupType = 'brackets' | 'square'
export type Groups = (Token | Group)[]
export interface Group {
  type: GroupType
  members: Groups
}

const groupings: Partial<Record<TokenType, {close: TokenType; type: GroupType}>> = {
  'b-open': {close: 'b-close', type: 'brackets'},
  's-open': {close: 's-close', type: 'square'},
}

export function build_groups(tokens: Token[]): Groups {
  let depth = 0
  let open: TokenType | null = null
  let close: TokenType | null = null
  const members: Groups = []
  let current_group_type: GroupType | null = null
  let group_tokens: Token[] = []
  for (const token of tokens) {
    if (depth == 0) {
      const g = groupings[token.type]
      if (g) {
        close = g.close
        open = token.type
        current_group_type = g.type
        depth = 1
      } else {
        members.push(token)
      }
    } else {
      if (token.type == open) {
        depth++
        group_tokens.push(token)
      } else if (token.type == close) {
        depth--
        if (depth == 0) {
          members.push({
            type: current_group_type as GroupType,
            members: build_groups(group_tokens),
          })
          group_tokens = []
        } else {
          group_tokens.push(token)
        }
      } else {
        group_tokens.push(token)
      }
    }
  }
  if (depth != 0) {
    throw Error(`Unclosed group "${open}", "${close}" not found before end of string`)
  }
  return members
}

// https://docs.python.org/3/reference/expressions.html#operator-precedence
const operators: TokenType[] = [
  'chain',
  'chain-op',
  'pipe',
  'mult',
  'dev',
  'add',
  'sub',
  'equals',
  'not-equals',
  'in',
  'not',
  'and',
  'or',
  'comma',
]

const things: Set<TokenType> = new Set(['num', 'token', 'string'])

// class GroupTokens {
//   tokens: Token[]
//   index: number
//
//   constructor(tokens: Token[]) {
//     this.tokens = tokens
//     this.index = 0
//   }
//
//   group(): Token[] {
//     const groups = []
//     while (this.index < this.tokens.length) {
//       const g = this._get_token()
//       if (g) {
//         groups.push(g)
//       }
//       this.index++
//     }
//     return groups
//   }
//
//   _get_token() {
//
//   }
// }
