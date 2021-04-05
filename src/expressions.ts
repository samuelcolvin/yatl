
const numbers = new Set('1234567890')

type TokenType = (
  'add'
  | 'sub'
  | 'dev'
  | 'mult'
  | 'pipe'
  | 'not'
  | 'open'
  | 'close'
  | 'comma'
  | 'chain'
  | 'op-chain'
  | 'equals'
  | 'not-equals'
  | 'or'
  | 'and'
  | 'in'
  | 'num'
  | 'var'
  | 'string'
)

interface MultiOp {
  letter: string
  peek: string
  type: TokenType
}
const multi_ops: MultiOp[] = [
  {letter: '=', peek: '=', type: 'equals'},
  {letter: '=', peek: '!', type: 'not-equals'},
  {letter: '|', peek: '|', type: 'or'},
  {letter: '&', peek: '&', type: 'and'},
  {letter: '.', peek: '?', type: 'op-chain'},
]

const single_ops: Record<string, TokenType> = {
  '(': 'open',
  ')': 'close',
  ',': 'comma',
  '.': 'chain',
  '+': 'add',
  '-': 'sub',
  '/': 'dev',
  '*': 'mult',
  '|': 'pipe',
  '!': 'not',
}
const keywords: Set<TokenType> = new Set(['in', 'or', 'and', 'not'])

interface Token {
  type: TokenType
  value?: string
}

export function* tokenize(exp: string): Generator<Token, void, void> {
  exp = exp.trim()
  for (let index = 0; index < exp.length; index++) {
    const letter = exp[index]
    const peek = exp[index + 1]

    // multi_ops have to come first has some of their first characters match single_ops
    for (let multi_op of multi_ops) {
      if (letter == multi_op.letter && peek == multi_op.peek) {
        yield {type: multi_op.type}
      }
    }

    const op = single_ops[letter]
    if (op) {
      yield {type: op}
      continue
    }

    if (numbers.has(letter)) {
      let value = letter
      while (true) {
        const new_letter = exp[index + 1]
        if (!numbers.has(new_letter)) {
          yield {type: 'num', value}
          break
        }
        value += new_letter
        index++
      }
    }

    if (/[a-zA-Z]/.test(letter)) {
      let value = letter
      while (true) {
        const new_letter = exp[index + 1]
        if (!/[a-zA-Z_]/.test(new_letter)) {
          if (keywords.has(value as any)) {
            yield {type: value as TokenType}
          } else {
            yield {type: 'var', value}
          }
          break
        }
        value += new_letter
        index++
      }
    }
    if (letter == '"' || letter == "'") {
      let value = ''
      let new_letter = ''
      while (true) {
        const escape = new_letter == '\\'
        new_letter = exp[index + 1]
        if (!escape && new_letter == letter) {
          yield {type: 'string', value}
          break
        }
        value += new_letter
        index++
      }
    }
    throw Error(`Unable to tokenize expressing at char ${index + 1} "${letter}"`)
  }
}
