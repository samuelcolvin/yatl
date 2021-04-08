import {shouldnt_happen, is_object} from '../utils'
import type {Clause, Operation, OperatorType, Modified, Var, Func, ChainElement} from './build'

export type Result = string | number | boolean | null | undefined | Date | Result[]

type LookupType<R> = {[key: string]: R | (R | LookupType<R>)[] | LookupType<R>}
export type Context = LookupType<Result>
type TemplateFunction = (...args: any[]) => Result | TemplateFunction
export type Functions = LookupType<TemplateFunction>

export default class Evaluator {
  context: Context
  functions: Functions
  operator_functions: Record<OperatorType, (a: any, b: any) => Result>

  constructor(context: Context, functions: Functions) {
    this.context = context
    this.functions = functions

    this.operator_functions = {
      '|': (a, b) => this._filter_run(a, b),
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
        return this._func_run(c)
      case 'mod':
        return this._modifiers(c)
      case 'operator':
        return this._operation(c)
      default:
        shouldnt_happen(c)
    }
  }

  _var(v: Var): Result {
    return this._lookup_value(v, this.context, 'context')
  }

  _func_run(f: Func): Result {
    const func = this._func_get(f)
    const r = func(...f.args.map(a => this.evaluate(a)))
    if (typeof r == 'function') {
      throw Error('filter functions may not be called directly')
    }
    return r
  }

  _func_get(f: Func): TemplateFunction {
    const func = this._lookup_value(f.var, this.functions, 'functions')

    if (typeof func == 'function') {
      return func
    } else if (func) {
      throw Error(`"${f.var.symbol}" an object, not a function`)
    } else {
      throw Error(`function "${f.var.symbol}" not found`)
    }
  }

  _operation(op: Operation): Result {
    const func = this.operator_functions[op.operator]
    if (op.operator == '|') {
      // func here is _filter_run
      return op.args.slice(1).reduce(func, this.evaluate(op.args[0]))
    } else {
      const args = op.args.map(a => this.evaluate(a))
      return args.slice(1).reduce(func, args[0])
    }
  }

  _filter_run(a: Result, filter: Var | Func): Result {
    let func: TemplateFunction
    if (filter.type == 'var') {
      func = this._func_get({type: 'func', var: filter, args: []})
    } else {
      const outer_func = this._func_get(filter)
      const func_ = outer_func(...filter.args.map(a => this.evaluate(a)))
      if (typeof func_ != 'function') {
        throw Error('filter functions must return another function')
      }
      func = func_
    }
    const r = func(a)
    if (typeof r == 'function') {
      throw Error('filters may not return a function')
    }
    return r
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

  _lookup_value(v: Var, namespace: Record<string, any>, namespace_name: string): any {
    let value = namespace[v.symbol]
    if (typeof value == 'undefined') {
      throw Error(`"${v.symbol}" not found in ${namespace_name}`)
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
        const _key = this.context[c.lookup]
        if (typeof _key == 'undefined') {
          throw Error(`lookup "${c.lookup}" not found`)
        } else if (typeof _key != 'string' && typeof _key != 'number') {
          throw Error(`"${c.lookup}" must be a string or number`)
        }
        key = _key
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
}
