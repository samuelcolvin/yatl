import type {Result} from './expressions/evaluate'

export function shouldnt_happen(type: never): never {
  throw Error(`Internal Error: got unexpected type ${JSON.stringify(type)}`)
}

export const is_upper_case = (name: string): boolean => name == name.toUpperCase()

type Type =
  | 'null'
  | 'undefined'
  | 'number'
  | 'boolean'
  | 'date'
  | 'regexp'
  | 'string'
  | 'array'
  | 'object'
  | 'function'

export const smart_typeof = (obj: any): Type => {
  /**
   * Helper to get the type of objects, works even for primitives, see
   * https://stackoverflow.com/questions/30476150/javascript-deep-comparison-recursively-objects-and-properties
   */
  return Object.prototype.toString
    .call(obj)
    .replace(/\[object (.+)]/, '$1')
    .toLowerCase() as Type
}

export const has_property = (obj: any, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key)

export const is_object = (v: any): boolean => smart_typeof(v) == 'object'

export function smart_equals(a: Result, b: Result): boolean {
  /**
   * Recursively check if two objects are equal
   */
  // If a and b reference the same value, return true
  if (a === b) {
    return true
  }

  // If a and b aren't the same type, return false
  if (typeof a != typeof b) {
    return false
  }

  // Already know types are the same, so if type is number
  // and both NaN, return true
  if (typeof a == 'number' && isNaN(a) && isNaN(b as number)) {
    return true
  }

  const a_type = smart_typeof(a)
  const b_type = smart_typeof(b)

  // Return false if not same class
  if (a_type != b_type) {
    return false
  }

  if (a_type == 'undefined' || a_type == 'null') {
    return a_type == b_type
  }

  // If they're Boolean, String or Number objects, check values
  if (a_type == 'boolean' || a_type == 'string' || a_type == 'number') {
    return (a as boolean).valueOf() == (b as boolean).valueOf()
  }

  if (a_type == 'date' || a_type == 'regexp' || a_type == 'function') {
    return (a as Date).toString() == (b as Date).toString()
  }

  if (a_type == 'object') {
    const a_obj = a as Record<string, Result>
    const b_obj = b as Record<string, Result>

    const a_keys = Object.keys(a_obj)
    const b_keys = Object.keys(b_obj)

    if (a_keys.length != b_keys.length) {
      return false
    }
    if (!a_keys.every(k => has_property(b_obj, k))) {
      return false
    }
    return Object.entries(a_obj).every(([k, v]) => smart_equals(v, b_obj[k]))
  } else if (a_type == 'array') {
    const a_array = a as Result[]
    const b_array = b as Result[]
    if (a_array.length != b_array.length) {
      return false
    }
    return a_array.every((aa, i) => smart_equals(aa, b_array[i]))
  } else {
    return false
  }
}
