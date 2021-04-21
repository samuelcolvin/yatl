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

export async function evaluate_clause_str(clause: Clause, context: Context, functions: Functions): Promise<string> {
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

export async function evaluate_clause_bool(clause: Clause, context: Context, functions: Functions): Promise<boolean> {
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
