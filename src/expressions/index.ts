import tokenize from './tokenize'
import build_expression, {Clause} from './build'
import Evaluator, {Context, Functions, Result} from './evaluate'

export function build_clause(expression: string): Clause {
  const tokens = tokenize(expression)
  return build_expression(tokens)
}

export function evaluate(expression: string, context: Context, functions: Functions): Result {
  const clause = build_clause(expression)
  const e = new Evaluator(context, functions)
  return e.evaluate(clause)
}
