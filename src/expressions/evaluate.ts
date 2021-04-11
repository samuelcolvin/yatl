import {shouldnt_happen, is_object, smart_equals, smart_typeof, has_property} from '../utils'
import type {Clause, Operation, OperatorType, Modified, Var, Func, ChainElement} from './build'

export type Result = string | number | boolean | null | undefined | Date | Result[] | {[key: string]: Result}

type LookupType<R> = {[key: string]: R | (R | LookupType<R>)[] | LookupType<R>}
export type Context = LookupType<Result>
type TemplateFunction = (...args: any[]) => Result | TemplateFunction
export type Functions = LookupType<TemplateFunction>

export default class Evaluator {
  context: Context
  functions: Functions
  operator_functions: Record<OperatorType, (value: Result, args: Clause[]) => Result>

  constructor(context: Context, functions: Functions) {
    this.context = context
    this.functions = functions
    this.evaluate = this.evaluate.bind(this)

    this.operator_functions = {
      '|': (value, args) => args.reduce((a, b) => this._filter_run(a, b as Var | Func), value),
      '*': (value, args) => this._op_mult_div(value, args, '*'),
      '/': (value, args) => this._op_mult_div(value, args, '/'),
      '+': this._op_add.bind(this),
      '-': this._op_subtract.bind(this),
      in: this._op_in.bind(this),
      '==': this._op_equals.bind(this),
      '!=': this._op_not_equals.bind(this),
      '&&': this._op_and.bind(this),
      '||': this._op_or.bind(this),
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
    return func(this.evaluate(op.args[0]), op.args.slice(1))
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

  _op_mult_div(value: Result, args: Clause[], op: '*' | '/'): number {
    if (typeof value != 'number') {
      throw TypeError(`arithmetic operation ${op} only possible on numbers, got ${typeof value}`)
    }
    for (const arg of args) {
      if (!value) {
        return value
      }
      const arg_num = this.evaluate(arg)
      if (typeof arg_num == 'number') {
        if (op == '*') {
          value *= arg_num
        } else {
          value /= arg_num
        }
      } else {
        throw TypeError(`arithmetic operation "${op}" only possible on numbers, got ${typeof arg_num}`)
      }
    }
    return value
  }

  _op_add(value: Result, args: Clause[]): number | Result[] | {[key: string]: Result} {
    const value_type = smart_typeof(value)
    switch (value_type) {
      case 'number':
        return args.reduce(this._add_numbers.bind(this), value as number)
      case 'array':
        return args.reduce(this._add_arrays.bind(this), value as any[])
      case 'object':
        return args.reduce(this._add_objects.bind(this), value as {[key: string]: Result})
      default:
        throw TypeError(`unable to add ${value_type}s`)
    }
  }

  _add_numbers(a: number, b: Clause): number {
    const v = this.evaluate(b)
    if (typeof v != 'number') {
      throw TypeError(`only number can be added to number, not ${typeof b}`)
    }
    return a + v
  }

  _add_arrays(a: Result[], b: Clause): Result[] {
    const v = this.evaluate(b)
    if (!Array.isArray(v)) {
      throw TypeError(`only arrays can be added to arrays, not ${typeof v}`)
    }
    return [...a, ...v]
  }

  _add_objects(a: {[key: string]: Result}, b: Clause): {[key: string]: Result} {
    const v = this.evaluate(b)
    if (typeof v != 'object' || !v) {
      throw TypeError(`only objects can be added to objects, not ${typeof v}`)
    }
    return {...a, ...v} as any
  }

  _op_subtract(value: Result, args: Clause[]): number | Result[] | {[key: string]: Result} {
    if (typeof value != 'number') {
      throw TypeError(`only numbers can be subtracted, not ${typeof value}`)
    }
    return args.reduce(this._subtract_numbers.bind(this), value)
  }

  _subtract_numbers(a: number, b: Clause): number {
    const v = this.evaluate(b)
    if (typeof v != 'number') {
      throw TypeError(`only numbers can be subtracted, not ${typeof b}`)
    }
    return a - v
  }

  _op_in(value: Result, args: Clause[]): boolean {
    const container = this.evaluate(args[0])
    const container_type = smart_typeof(container)
    if (container_type == 'object') {
      if (typeof value != 'string') {
        return false
      } else {
        return has_property(container, value)
      }
    } else if (container_type == 'array') {
      return (container as Result[]).includes(value)
    } else if (container_type == 'string') {
      if (typeof value != 'string') {
        return false
      } else {
        return (container as string).includes(value)
      }
    } else {
      throw TypeError(`"in" is only possible for objects, arrays and strings, not "${container_type}`)
    }
  }

  _op_equals = (value: Result, args: Clause[]): boolean => args.every(a => smart_equals(value, this.evaluate(a)))
  _op_not_equals = (value: Result, args: Clause[]): boolean => args.every(a => !smart_equals(value, this.evaluate(a)))
  _op_and = (value: Result, args: Clause[]): boolean => !!(value && args.every(this.evaluate))
  _op_or = (value: Result, args: Clause[]): boolean => !!(value || !args.every(c => !this.evaluate(c)))

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
