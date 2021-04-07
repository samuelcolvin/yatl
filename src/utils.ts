export function shouldnt_happen(type: never): never {
  throw Error(`Internal Error: got unexpected type ${JSON.stringify(type)}`)
}

export const is_object = (v: any): boolean => typeof v == 'object' && !!v
