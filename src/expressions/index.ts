import tokenize from './tokenize'
import build_expression, {Clause} from './build'

export function build(expression: string): Clause {
  const tokens = tokenize(expression)
  return build_expression(tokens)
}
