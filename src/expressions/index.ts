import {smart_typeof, SmartType} from '../utils'
import tokenize from './tokenize'
import build_expression, {Clause} from './build'
import Evaluator, {Context, Functions, Result} from './evaluate'

export function build_clause(expression: string): Clause {
  const tokens = tokenize(expression)
  return build_expression(tokens)
}

export async function evaluate_clause(clause: Clause, context: Context, functions: Functions): Promise<Result> {
  const e = new Evaluator(context, functions)
  return await e.evaluate(clause)
}

export async function evaluate_string(expression: string, context: Context, functions: Functions): Promise<Result> {
  const clause = build_clause(expression)
  return await evaluate_clause(clause, context, functions)
}

export async function evaluate_as_str(clause: Clause, context: Context, functions: Functions): Promise<string> {
  const v = await evaluate_clause(clause, context, functions)
  if (typeof v == 'string') {
    return v
  } else if (typeof v == 'number') {
    return v.toString()
  } else if (v == null) {
    return ''
  } else {
    throw TypeError(`Only strings and numbers can be rendered in templates, not ${typeof v}`)
  }
}

export async function evaluate_as_bool(clause: Clause, context: Context, functions: Functions): Promise<boolean> {
  const v = await evaluate_clause(clause, context, functions)
  const t = smart_typeof(v)
  if (t == SmartType.Array) {
    return (v as any[]).length > 0
  } else if (t == SmartType.Object) {
    return Object.keys(v as Record<any, any>).length > 0
  } else {
    return Boolean(v)
  }
}

function map_items(item: any, names: string[]) {
  switch (smart_typeof(item)) {
    case SmartType.Array:
      if (item.length != names.length) {
        throw new Error(`Loop variable names ${JSON.stringify(names)} cannot be mapped to ${JSON.stringify(item)}`)
      }
      return Object.fromEntries(names.map((name, i) => [name, item[i]]))
    case SmartType.Object:
      if (Object.keys(item).length != names.length) {
        throw new Error(`Loop variable names ${JSON.stringify(names)} cannot be mapped to ${JSON.stringify(item)}`)
      }
      return Object.fromEntries(names.map(name => [name, item[name]]))
    default:
      throw new Error(`Loop variable names ${JSON.stringify(names)} cannot be mapped to ${JSON.stringify(item)}`)
  }
}

export async function evaluate_as_loop(
  clause: Clause,
  names: string[],
  context: Context,
  functions: Functions,
): Promise<any[]> {
  const v = await evaluate_clause(clause, context, functions)
  const t = smart_typeof(v)
  if (t == SmartType.Array) {
    const arr = v as any[]
    if (names.length == 1) {
      const name = names[0]
      return arr.map(item => ({[name]: item}))
    } else {
      return arr.map(item => map_items(item, names))
    }
  } else if (t == SmartType.Object) {
    const obj = v as Record<any, any>
    const [key_name, value_name] = names
    switch (names.length) {
      case 1:
        return Object.values(obj).map(item => ({[key_name]: item}))
      case 2:
        return Object.entries(obj).map(([key, value]) => ({[key_name]: key, [value_name]: value}))
      default:
        throw new Error(`objects can only be mapped to one or two names, not ${names.length} names`)
    }
  } else {
    throw new Error(`${t}s can't be used in for loop expressions`)
  }
}
