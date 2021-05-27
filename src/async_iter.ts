export async function async_map<A, R>(items: A[], func: (i: A) => Promise<R>): Promise<R[]> {
  return await Promise.all(items.map(item => func(item)))
}

export async function async_reduce<A, B>(items: B[], func: (a: A, b: B) => Promise<A>, value: A): Promise<A> {
  for (const item of items) {
    value = await func(value, item)
  }
  return value
}

export async function async_every<A>(items: A[], func: (i: A) => Promise<any>): Promise<boolean> {
  for (const item of items) {
    if (!(await func(item))) {
      return false
    }
  }
  return true
}

export async function async_any<A>(items: A[], func: (i: A) => Promise<any>): Promise<boolean> {
  for (const item of items) {
    if (await func(item)) {
      return true
    }
  }
  return false
}
