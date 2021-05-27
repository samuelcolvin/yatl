import {async_map, async_every, async_reduce, async_any} from '../async_iter'
import {has_property, is_object, shouldnt_happen, smart_equals, smart_typeof, SmartType} from '../utils'
import type {ChainElement, Clause, Func, Modified, Operation, OperatorType, Var} from './build'

export type Result = string | number | boolean | null | undefined | Date | Result[] | {[key: string]: Result}

type LookupType<R> = {[key: string]: R | (R | LookupType<R>)[] | LookupType<R>}
export type Context = LookupType<Result>
type AsyncFunction = (...args: any[]) => Promise<Result>
type TemplateFunction = (...args: any[]) => Promise<Result | AsyncFunction>
export type Functions = LookupType<TemplateFunction>

export default class Evaluator {
  private readonly context: Context
  private readonly functions: Functions
  private readonly operator_functions: Record<OperatorType, (value: Result, args: Clause[]) => Promise<Result>>

  constructor(context: Context, functions: Functions) {
    this.context = context
    this.functions = functions
    this.evaluate = this.evaluate.bind(this)

    this.operator_functions = {
      '|': (value, args) => async_reduce(args, (a, b) => this.filter_run(a, b as Var | Func), value),
      '*': (value, args) => this.op_mult_div(value, args, '*'),
      '/': (value, args) => this.op_mult_div(value, args, '/'),
      '+': this.op_add.bind(this),
      '-': this.op_subtract.bind(this),
      in: this.op_in.bind(this),
      '!in': async (value, args) => !(await this.op_in(value, args)),
      '==': this.op_equals.bind(this),
      '!=': this.op_not_equals.bind(this),
      '&&': this.op_and.bind(this),
      '||': this.op_or.bind(this),
    }
  }

  async evaluate(c: Clause): Promise<Result> {
    switch (c.type) {
      case 'var':
        return this.var(c)
      case 'str':
      case 'num':
      case 'bool':
        return c.value
      case 'list':
        return await async_map(c.elements, this.evaluate)
      case 'func':
        return await this.func_run(c)
      case 'mod':
        return await this.modifiers(c)
      case 'operator':
        return await this.operation(c)
      default:
        shouldnt_happen(c)
    }
  }

  private var(v: Var): Result {
    return this.lookup_value(v, this.context, 'context')
  }

  private async func_run(f: Func): Promise<Result> {
    const func = this.func_get(f)
    const args = await async_map(f.args, this.evaluate)
    const r = await func(...args)
    if (typeof r == 'function') {
      throw Error('filter functions may not be called directly')
    }
    return r
  }

  private func_get(f: Func): TemplateFunction {
    const func = this.lookup_value(f.var, this.functions, 'functions')

    if (typeof func == 'function') {
      return func
    } else if (func) {
      throw Error(`"${f.var.symbol}" an object, not a function`)
    } else {
      throw Error(`function "${f.var.symbol}" not found`)
    }
  }

  private async operation(op: Operation): Promise<Result> {
    const func = this.operator_functions[op.operator]
    return await func(await this.evaluate(op.args[0]), op.args.slice(1))
  }

  private async filter_run(a: Result, filter: Var | Func): Promise<Result> {
    let func: TemplateFunction
    if (filter.type == 'var') {
      func = this.func_get({type: 'func', var: filter, args: []})
    } else {
      const outer_func = this.func_get(filter)
      const args = await async_map(filter.args, this.evaluate)
      const func_ = await outer_func(...args)
      if (typeof func_ != 'function') {
        throw Error('filter functions must return another function')
      }
      func = func_
    }
    const r = await func(a)
    if (typeof r == 'function') {
      throw Error('filters may not return a function')
    }
    return r
  }

  private async op_mult_div(value: Result, args: Clause[], op: '*' | '/'): Promise<number> {
    if (typeof value != 'number') {
      throw TypeError(`arithmetic operation ${op} only possible on numbers, got ${typeof value}`)
    }
    for (const arg of args) {
      if (!value) {
        return value
      }
      const arg_num = await this.evaluate(arg)
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

  private async op_add(value: Result, args: Clause[]): Promise<number | Result[] | {[key: string]: Result}> {
    const value_type = smart_typeof(value)
    switch (value_type) {
      case SmartType.Number:
        return await async_reduce(args, this.add_numbers.bind(this), value as number)
      case SmartType.Array:
        return await async_reduce(args, this.add_arrays.bind(this), value as any[])
      case SmartType.Object:
        return await async_reduce(args, this.add_objects.bind(this), value as {[key: string]: Result})
      default:
        throw TypeError(`unable to add ${value_type}s`)
    }
  }

  private async add_numbers(a: number, b: Clause): Promise<number> {
    const v = await this.evaluate(b)
    if (typeof v != 'number') {
      throw TypeError(`only number can be added to number, not ${typeof b}`)
    }
    return a + v
  }

  private async add_arrays(a: Result[], b: Clause): Promise<Result[]> {
    const v = await this.evaluate(b)
    if (!Array.isArray(v)) {
      throw TypeError(`only arrays can be added to arrays, not ${typeof v}`)
    }
    return [...a, ...v]
  }

  private async add_objects(a: {[key: string]: Result}, b: Clause): Promise<{[key: string]: Result}> {
    const v = await this.evaluate(b)
    if (typeof v != 'object' || !v) {
      throw TypeError(`only objects can be added to objects, not ${typeof v}`)
    }
    return {...a, ...v} as any
  }

  private async op_subtract(value: Result, args: Clause[]): Promise<number | Result[] | {[key: string]: Result}> {
    if (typeof value != 'number') {
      throw TypeError(`only numbers can be subtracted, not ${typeof value}`)
    }
    return await async_reduce(args, this.subtract_numbers.bind(this), value)
  }

  private async subtract_numbers(a: number, b: Clause): Promise<number> {
    const v = await this.evaluate(b)
    if (typeof v != 'number') {
      throw TypeError(`only numbers can be subtracted, not ${typeof b}`)
    }
    return a - v
  }

  private async op_in(value: Result, args: Clause[]): Promise<boolean> {
    const container = await this.evaluate(args[0])
    const container_type = smart_typeof(container)
    if (container_type == SmartType.Object) {
      if (typeof value != 'string') {
        return false
      } else {
        return has_property(container, value)
      }
    } else if (container_type == SmartType.Array) {
      return (container as Result[]).includes(value)
    } else if (container_type == SmartType.String) {
      if (typeof value != 'string') {
        return false
      } else {
        return (container as string).includes(value)
      }
    } else {
      throw TypeError(`"in" is only possible for objects, arrays and strings, not "${container_type}`)
    }
  }

  private op_equals = (value: Result, args: Clause[]): Promise<boolean> =>
    async_every(args, async a => smart_equals(value, await this.evaluate(a)))
  private op_not_equals = (value: Result, args: Clause[]): Promise<boolean> =>
    async_every(args, async a => !smart_equals(value, await this.evaluate(a)))
  private op_and = async (value: Result, args: Clause[]): Promise<boolean> =>
    !!(value && (await async_every(args, this.evaluate)))
  private op_or = async (value: Result, args: Clause[]): Promise<boolean> =>
    !!(value || (await async_any(args, this.evaluate)))

  private async modifiers(mod: Modified): Promise<Result> {
    if (mod.mod == '!') {
      return !(await this.evaluate(mod.element))
    } else {
      // minus
      const v = await this.evaluate(mod.element)
      if (typeof v == 'number') {
        return -v
      } else {
        throw Error(`negative of ${typeof v} is not valid`)
      }
    }
  }

  private lookup_value(v: Var, namespace: Record<string, any>, namespace_name: string): any {
    let value = namespace[v.symbol]
    if (value === undefined) {
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
        if (_key === undefined) {
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
