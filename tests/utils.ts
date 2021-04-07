import type {Token, TokenType} from '../src/tokenize'
import type {MixedElement, Clause, Var} from '../src/expressions'

export const token_as_compact = (t: Token): string => (typeof t.value != 'undefined' ? `${t.type}:${t.value}` : t.type)

export function compact_as_token(s: string): Token {
  if (s.includes(':')) {
    const [type, value] = s.split(':', 2)
    if (type == 'num') {
      return {type: type, value: parseFloat(value)}
    } else {
      return {type: type as TokenType, value}
    }
  } else {
    return {type: s as TokenType}
  }
}

export function mixed_as_compact(g: MixedElement): string | Record<string, any> {
  switch (g.type) {
    case 'group':
      return {[g.subtype]: g.args.map(a => a.map(mixed_as_compact))}
    case 'var':
      return var_as_compact(g)
    case 'func':
      return {func: var_as_compact(g.var), args: g.args.map(a => a.map(mixed_as_compact))}
    default:
      return token_as_compact(g)
  }
}

export function compact_as_mixed(s: string | Record<string, any>): MixedElement {
  if (typeof s == 'string') {
    return compact_string_as_mixed(s)
  } else {
    if ('func' in s) {
      return {
        type: 'func',
        temp: true,
        var: compact_as_var(s.func),
        args: s.args.map((a: string[]) => a.map(compact_as_mixed)),
      }
    }
    const [key, value] = Object.entries(s)[0]
    if (key == '()' || key == '[]') {
      return {
        type: 'group',
        subtype: key,
        args: value.map((a: string[]) => a.map(compact_as_mixed)),
      }
    } else if (key.startsWith('var:')) {
      return compact_as_var(s)
    } else {
      throw Error(`Unknown compact type: ${JSON.stringify(s)}`)
    }
  }
}

export function clause_as_compact(g: Clause): string | Record<string, any> {
  switch (g.type) {
    case 'list':
      return g.elements.map(clause_as_compact)
    case 'var':
      return var_as_compact(g)
    case 'func':
      return {func: var_as_compact(g.var), args: g.args.map(clause_as_compact)}
    case 'mod':
      return {[`mod:${g.mod}`]: clause_as_compact(g.element)}
    case 'operator':
      return {[`op:${g.operator}`]: g.args.map(clause_as_compact)}
    default:
      return `${g.type}:${g.value}`
  }
}

export function compact_as_clause(s: string | any[] | Record<string, any>): Clause {
  if (typeof s == 'string') {
    return compact_string_as_mixed(s) as Clause
  } else if (Array.isArray(s)) {
    return {type: 'list', elements: s.map(compact_as_clause)}
  } else {
    if ('func' in s) {
      return {
        type: 'func',
        var: compact_as_var(s.func),
        args: s.args.map(compact_as_clause),
      }
    }
    const [key, value] = Object.entries(s)[0]
    if (key.startsWith('var:')) {
      return compact_as_var(s)
    } else if (key.startsWith('mod:')) {
      return {
        type: 'mod',
        mod: key.substr(4) as any,
        element: compact_as_clause(value),
      }
    } else if (key.startsWith('op:')) {
      return {
        type: 'operator',
        operator: key.substr(3) as any,
        args: value.map(compact_as_clause),
      }
    } else {
      throw Error(`Unknown compact type: ${JSON.stringify(s)}`)
    }
  }
}

function compact_string_as_mixed(s: string): MixedElement {
  if (s.startsWith('var:')) {
    return {type: 'var', id: s.substr(4), chain: []}
  } else {
    return compact_as_token(s)
  }
}

function var_as_compact(v: Var): string | Record<string, string> {
  if (v.chain.length) {
    return {[`var:${v.id}`]: v.chain.map(c => c.op + (c.type == 'string' ? c.lookup : `[${c.lookup}]`)).join('')}
  } else {
    return `var:${v.id}`
  }
}

function compact_as_var(s: Record<string, string> | string): Var {
  if (typeof s == 'string') {
    return {type: 'var', id: s.substr(4), chain: []}
  }
  const [key, value] = Object.entries(s)[0]
  let chain: any[] = []
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
          type = 'id'
          lookup = lookup.substr(1, lookup.length - 2)
        }
        return {op, type, lookup}
      })
  }
  return {
    type: 'var',
    id: key.substr(4),
    chain,
  }
}
