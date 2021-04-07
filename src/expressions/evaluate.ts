import {shouldnt_happen, is_object} from '../utils'
import type {Clause, Operation, OperatorType, Modified, Var, Func, ChainElement} from './build'

export type Context = Record<string, any>
export type Result = string | number | boolean | null | undefined | Result[]
export type Functions = Record<string, (...args: any[]) => Result>

export default class Evaluator {
  context: Context
  functions: Functions
  operator_functions: Record<OperatorType, (a: any, b: any) => any>

  constructor(context: Context, functions: Functions) {
    this.context = context
    this.functions = functions

    this.operator_functions = {
      '|': (a: any, b: Var) => {
        // TODO deal with functions
        const func = this.functions[b.symbol]
        if (!func) {
          throw Error(`function "${b.symbol}" not found`)
        }
        return func(a)
      },
      '*': (a, b) => a * b,
      '/': (a, b) => a / b,
      '+': (a, b) => a + b,
      '-': (a, b) => a - b,
      '==': (a, b) => a == b,
      '!=': (a, b) => a != b,
      in: (a, b) => b.includes(a),
      '&&': (a, b) => a && b,
      '||': (a, b) => a || b,
    }
  }

  evaluate(c: Clause): Result {
    switch (c.type) {
      case 'var':
        return this._var(c)
      case 'str':
      case 'num':
      case 'bool':
        return c.value
      case 'list':
        return c.elements.map(e => this.evaluate(e))
      case 'func':
        return this._func(c)
      case 'mod':
        return this._modifiers(c)
      case 'operator':
        return this._operation(c)
      default:
        shouldnt_happen(c)
    }
  }

  _var(v: Var): Result {
    let value = this.context[v.symbol]
    if (typeof value == 'undefined') {
      throw Error(`"${v.symbol}" not found in context`)
    }
    const steps: (string | number)[] = []

    const name = (): string => v.symbol + steps.map(s => `[${JSON.stringify(s)}]`).join('')
    function return_or_error(c: ChainElement, key: string | number) {
      if (c.op == '.?') {
        return undefined
      } else {
        steps.pop()
        throw Error(`"${key}" not found in "${name()}"`)
      }
    }

    for (const c of v.chain) {
      let key: string | number = c.lookup
      if (c.type == 'symbol') {
        key = this.context[c.lookup]
        if (typeof value == 'undefined') {
          throw Error(`lookup symbol "${c.lookup}" is not defined`)
        }
      }
      steps.push(key)

      if (typeof key == 'number') {
        if (Array.isArray(value)) {
          if (key >= 0 && key < value.length) {
            value = value[key]
          } else {
            return return_or_error(c, key)
          }
        } else {
          throw Error(`${name()}: numeric lookups are only allowed on arrays, not ${typeof value}`)
        }
      } else {
        if (is_object(value)) {
          if (key in value) {
            value = value[key]
          } else {
            return return_or_error(c, key)
          }
        } else {
          throw Error(`${name()}: string lookups are only allowed on objects, not ${typeof value}`)
        }
      }
    }
    return value
  }

  _func(f: Func): Result {
    if (f.var.chain.length) {
      throw Error('chained function lookups are not yet supported')
    }
    const func = this.functions[f.var.symbol]
    if (!func) {
      throw Error(`function "${f.var.symbol}" not found`)
    }
    return func(...f.args.map(a => this.evaluate(a)))
  }

  _operation(op: Operation): Result {
    const func = this.operator_functions[op.operator]
    if (op.operator == '|') {
      return op.args.slice(1).reduce(func, this.evaluate(op.args[0]))
    } else {
      const args = op.args.map(a => this.evaluate(a))
      return args.slice(1).reduce(func, args[0])
    }
  }

  _modifiers(mod: Modified): Result {
    if (mod.mod == '!') {
      return !this.evaluate(mod.element)
    } else {
      // minus
      const v = this.evaluate(mod.element)
      if (typeof v == 'number') {
        return -v
      } else {
        throw Error(`negative of ${typeof v} is not valid`)
      }
    }
  }
}
