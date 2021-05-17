import type {Token, TokenType} from '../src/expressions/tokenize'
import type {MixedElement, Clause, Var} from '../src/expressions/build'
import fs from 'fs'
import {SAXParser} from 'sax-wasm'

export const token_as_compact = (t: Token): string => (t.value != undefined ? `${t.type}:${t.value}` : t.type)

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
    case 'mod':
    case 'operator':
      throw Error(`got unexpected type to mixed_as_compact: ${JSON.stringify(g)}`)
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
    return {type: 'var', symbol: s.substr(4), chain: []}
  } else {
    return compact_as_token(s)
  }
}

function var_as_compact(v: Var): string | Record<string, string> {
  if (v.chain.length) {
    return {[`var:${v.symbol}`]: v.chain.map(c => c.op + (c.type == 'str' ? c.lookup : `[${c.lookup}]`)).join('')}
  } else {
    return `var:${v.symbol}`
  }
}

function compact_as_var(s: Record<string, string> | string): Var {
  if (typeof s == 'string') {
    return {type: 'var', symbol: s.substr(4), chain: []}
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
        if (lookup.startsWith('num:')) {
          return {op, type: 'num', lookup: parseFloat(lookup.substr(4))}
        }
        let type = 'str'
        if (lookup.startsWith('[')) {
          type = 'symbol'
          lookup = lookup.slice(1, -1)
        }
        return {op, type, lookup}
      })
  }
  return {
    type: 'var',
    symbol: key.substr(4),
    chain,
  }
}

const sax_wasm_buffer = fs.readFileSync(require.resolve('sax-wasm/lib/sax-wasm.wasm'))

export async function load_wasm(parser: SAXParser): Promise<void> {
  await parser.prepareWasm(sax_wasm_buffer)
}
