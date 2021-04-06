import {Token, TokenType} from './tokenize'

/**
 * precedence: (see https://docs.python.org/3/reference/expressions.html#operator-precedence)
 * () and [] - groups
 *  '.', '.?' - chains
 *  token() - function arguments attached to vars
 *  | - filters
 *  '*', '/', '+', '-' - maths
 *  '==', '!=' - equals, not equals
 *  in - containment or loop
 *  '!' not
 *  '&&', '||' - and and or
 *  ',' - commas
 */

type GroupType = '()' | '[]'
export type MixedElement = Token | Group | Var

export interface Group {
  type: 'group'
  subtype: GroupType
  members: MixedElement[]
}

const groupings: Partial<Record<TokenType, {close: TokenType; type: GroupType}>> = {
  '(': {close: ')', type: '()'},
  '[': {close: ']', type: '[]'},
}

export function build_groups(tokens: Token[]): (Token | Group)[] {
  let depth = 0
  let open: TokenType | null = null
  let close: TokenType | null = null
  const members: (Token | Group)[] = []
  let current_group_type: GroupType | null = null
  let current_group_members: Token[] = []
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
        current_group_members.push(token)
      } else if (token.type == close) {
        depth--
        if (depth == 0) {
          members.push({
            type: 'group',
            subtype: current_group_type as GroupType,
            members: build_groups(current_group_members),
          })
          current_group_members = []
        } else {
          current_group_members.push(token)
        }
      } else {
        current_group_members.push(token)
      }
    }
  }
  if (depth != 0) {
    throw Error(`Unclosed group "${open}", "${close}" not found before end of string`)
  }
  return members
}

interface ChainElement {
  lookup: string
  type: 'string' | 'token'
  op: '.' | '.?'
}
interface Var {
  type: 'var'
  token: string
  chain: ChainElement[]
}

const is_chain_op = (g: Token | Group | undefined): boolean => !!g && (g.type == '.' || g.type == '.?')
const is_square_group = (g: Token | Group | undefined): boolean => !!g && g.type == 'group' && g.subtype == '[]'

function chain_from_brackets(g: Group, op: '.' | '.?' = '.'): ChainElement {
  if (g.members.length != 1) {
    throw Error('A single token or string must be used as the input to square brackets')
  }
  const arg = g.members[0]
  if (arg.type != 'token' && arg.type != 'string') {
    throw Error(`A token or string must be used as the input to square brackets, not "${arg.type}"`)
  }
  return {op, lookup: arg.value as string, type: arg.type}
}

export function build_chains(groups: (Token | Group)[]): (Token | Group | Var)[] {
  const new_groups: (Token | Group | Var)[] = []
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index]
    if (g.type == 'token') {
      const chain: ChainElement[] = []
      while (true) {
        const next = groups[index + 1]
        if (is_chain_op(next)) {
          const lookup = groups[index + 2]
          const op = next.type as '.' | '.?'
          if (is_square_group(lookup)) {
            chain.push(chain_from_brackets(lookup as Group, op))
          } else if (lookup.type == 'token') {
            // type here is string since we use the raw item, rather than considering it as a variable
            chain.push({op, lookup: lookup.value as string, type: 'string'})
          } else if (!lookup) {
            throw Error(`expression ended with operator "${op}", no final token`)
          } else {
            throw Error('"." and ".?" are only valid between tokens')
          }
          index += 2
        } else if (is_square_group(next)) {
          chain.push(chain_from_brackets(next as Group))
          index += 1
        } else {
          break
        }
      }

      new_groups.push({type: 'var', token: g.value as string, chain})
    } else if (g.type == 'group') {
      if (g.subtype == '[]') {
        throw Error('square brackets [] can only be used after a token')
      } else {
        new_groups.push({...g, members: build_chains(g.members as (Token | Group)[])})
      }
    } else if (is_chain_op(g)) {
      throw Error('"." and ".?" are only valid between tokens')
    } else {
      // normal token
      new_groups.push(g)
    }
  }
  return new_groups
}
