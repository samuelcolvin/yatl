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

type GroupSubtype = '()' | '[]'
export type MixedElement = Token | TempGroup | Var | TempFunc

export interface TempGroup {
  type: 'group'
  subtype: GroupSubtype
  args: MixedElement[][]
}

const groupings: Partial<Record<TokenType, {close: TokenType; type: GroupSubtype}>> = {
  '(': {close: ')', type: '()'},
  '[': {close: ']', type: '[]'},
}

export function build_groups(tokens: Token[]): (Token | TempGroup)[] {
  let depth = 0
  let open: TokenType | null = null
  let close: TokenType | null = null
  const members: (Token | TempGroup)[] = []
  let current_group_type: GroupSubtype | null = null
  let current_group_args: (Token | TempGroup)[][] = []
  let current_arg: Token[] = []
  for (const token of tokens) {
    if (depth == 0) {
      const g = groupings[token.type]
      if (g) {
        close = g.close
        open = token.type
        current_group_type = g.type
        depth = 1
      } else {
        if (token.type == ',') {
          throw Error('commas can only occur inside brackets')
        }
        members.push(token)
      }
    } else {
      if (token.type == open) {
        depth++
        current_arg.push(token)
      } else if (token.type == close) {
        depth--
        if (depth == 0) {
          if (current_arg.length) {
            current_group_args.push(build_groups(current_arg))
          }
          members.push({
            type: 'group',
            subtype: current_group_type as GroupSubtype,
            args: current_group_args,
          })
          current_group_args = []
          current_arg = []
        } else {
          current_arg.push(token)
        }
      } else {
        if (depth == 1 && token.type == ',') {
          current_group_args.push(build_groups(current_arg))
          current_arg = []
        } else {
          current_arg.push(token)
        }
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
  type: 'string' | 'symbol' | 'num'
  op: '.' | '.?'
}
export interface Var {
  type: 'var'
  symbol: string
  chain: ChainElement[]
}

export function build_chains(groups: (Token | TempGroup)[]): (Token | TempGroup | Var)[] {
  const new_groups: (Token | TempGroup | Var)[] = []
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index]
    if (g.type == 'symbol') {
      const chain: ChainElement[] = []
      while (true) {
        const next = groups[index + 1]
        if (is_chain_op(next)) {
          const lookup = groups[index + 2]
          const op = next.type as '.' | '.?'
          if (lookup && lookup.type == 'group' && lookup.subtype == '[]') {
            chain.push(chain_from_brackets(lookup, op))
          } else if (lookup.type == 'symbol') {
            // type here is string since we use the raw item, rather than considering it as a variable
            chain.push({op, lookup: lookup.value as string, type: 'string'})
          } else if (!lookup) {
            throw Error(`expression ended with operator "${op}", no final token`)
          } else {
            throw Error('"." and ".?" are only valid between tokens')
          }
          index += 2
        } else if (next && next.type == 'group' && next.subtype == '[]') {
          chain.push(chain_from_brackets(next, '.'))
          index += 1
        } else {
          break
        }
      }

      new_groups.push({type: 'var', symbol: g.value as string, chain})
    } else if (g.type == 'group') {
      if (g.subtype == '[]') {
        throw Error('square brackets [] can only be used after a token')
      } else {
        new_groups.push({...g, args: g.args.map(a => build_chains(a as (Token | TempGroup)[]))})
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

const is_chain_op = (g: Token | TempGroup | undefined): boolean => !!g && (g.type == '.' || g.type == '.?')

function chain_from_brackets(g: TempGroup, op: '.' | '.?'): ChainElement {
  if (g.args.length != 1 || g.args[0].length != 1) {
    throw Error('A single token or string must be used as the input to square brackets')
  }
  const arg = g.args[0][0]
  if (arg.type != 'symbol' && arg.type != 'string' && arg.type != 'num') {
    throw Error(`A token or string must be used as the input to square brackets, not "${arg.type}"`)
  }
  return {op, lookup: arg.value as string, type: arg.type}
}

interface TempFunc {
  type: 'func'
  temp: true
  var: Var
  args: MixedElement[][]
}

export function build_functions(groups: MixedElement[]): (Token | TempGroup | Var | TempFunc)[] {
  const new_groups: (Token | TempGroup | Var | TempFunc)[] = []
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index]
    if (g.type == 'var') {
      const next = groups[index + 1]
      if (next && next.type == 'group' && next.subtype == '()') {
        new_groups.push({type: 'func', temp: true, var: g, args: next.args})
        index++
        continue
      }
    }

    if (g.type == 'group') {
      new_groups.push({...g, args: g.args.map(build_functions)})
    } else {
      new_groups.push(g as Token | Var | TempFunc)
    }
  }
  return new_groups
}

type OperatorTypes = '|' | '*' | '/' | '+' | '-' | '==' | '!=' | 'in' | '&&' | '||'
// https://docs.python.org/3/reference/expressions.html#operator-precedence
const operator_precedence: OperatorTypes[] = ['|', '*', '/', '+', '-', '==', '!=', 'in', '&&', '||']

interface Modified {
  type: 'mod'
  mod: '!' | '-'
  element: Clause
}

interface Operation {
  type: 'operator'
  operator: OperatorTypes
  args: Clause[]
}

export function build_operators(groups: MixedElement[]): Clause {
  let tmp_groups: (MixedElement | Clause)[] = groups
  // og('original groups:', groups)
  for (const operator_type of operator_precedence) {
    const new_groups: (MixedElement | Clause)[] = []
    for (let index = 0; index < tmp_groups.length; index++) {
      const g = tmp_groups[index]
      const args: Clause[] = []
      while (index < tmp_groups.length - 1 && tmp_groups[index + 1].type == operator_type) {
        const arg = tmp_groups[index + 2] as MixedElement
        if (!arg) {
          throw Error(`expression ended unexpectedly with operator "${operator_type}"`)
        }
        if (arg.type == '!' || arg.type == '-') {
          const element = tmp_groups[index + 3] as MixedElement
          if (!element) {
            throw Error(`expression ended unexpectedly with modifier "${operator_type}"`)
          }
          index += 3
          args.push({type: 'mod', mod: arg.type, element: mixed_as_clause(element)})
        } else if (operator_precedence.includes(arg.type as any)) {
          throw Error(`operator "${operator_type}" followed by another operator "${arg.type}`)
        } else {
          args.push(mixed_as_clause(arg))
          index += 2
        }
      }

      if (args.length) {
        if (operator_type == 'in' && args.length > 1) {
          throw Error('chaining the "in" operator is not permitted')
        }
        const a1 = mixed_as_clause(g as MixedElement)
        new_groups.push({type: 'operator', operator: operator_type, args: [a1, ...args]})
      } else if (operator_precedence.includes(g.type as any)) {
        // operator still to be processed
        new_groups.push(g)
      } else {
        new_groups.push(mixed_as_clause(g))
      }
    }
    tmp_groups = new_groups
  }
  if (tmp_groups.length != 1) {
    throw Error(`internal error, ${tmp_groups.length} clauses found after reduction, should be just 1`)
  }
  return tmp_groups[0] as Clause
}

function mixed_as_clause(g: MixedElement | Clause): Clause {
  switch (g.type) {
    case 'group':
      if (g.subtype != '()') {
        throw Error(`internal error, unexpected group type "${g.subtype}"`)
      }
      if (g.args.length == 1) {
        return build_operators(g.args[0])
      } else {
        return {type: 'list', elements: g.args.map(build_operators)}
      }
    case 'func':
      if ('temp' in g) {
        return {type: 'func', var: g.var, args: g.args.map(build_operators)}
      } else {
        return g
      }
    case 'num':
      return {type: 'num', value: g.value as number}
    case 'string':
      return {type: 'str', value: g.value as string}
    case 'list':
    case 'mod':
    case 'operator':
    case 'var':
    case 'str':
      return g
    default:
      throw Error(`Internal Error: got unexpected element: ${JSON.stringify(g)}`)
  }
}

interface Num {
  type: 'num'
  value: number
}
interface Str {
  type: 'str'
  value: string
}
interface List {
  type: 'list'
  elements: Clause[]
}

interface Func {
  type: 'func'
  var: Var
  args: Clause[]
}

export type Clause = List | Var | Str | Num | Func | Operation | Modified

export default function build_expression(tokens: Token[]): Clause {
  const groups = build_groups(tokens)
  const chains = build_chains(groups)
  const functions = build_functions(chains)
  return build_operators(functions)
}
