import tokenize from './tokenize'
import build_expression, {Clause} from './build'
import Evaluator, {Context, Functions, Result} from './evaluate'

export function build_clause(expression: string): Clause {
  const tokens = tokenize(expression)
  return build_expression(tokens)
}

export async function evaluate(expression: string, context: Context, functions: Functions): Promise<Result> {
  const clause = build_clause(expression)
  const e = new Evaluator(context, functions)
  return await e.evaluate(clause)
}
