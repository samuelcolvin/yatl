const numbers = new Set('1234567890')

type TokenType =
  | 'add'
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
  | 'token'
  | 'string'

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

class Tokenize {
  exp: string
  index: number

  constructor(exp: string) {
    this.exp = exp.trim()
    this.index = 0
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (this.index < this.exp.length) {
      const t = this._get_token()
      if (t) {
        tokens.push(t)
      }
      this.index++
    }
    return tokens
  }

  _get_token(): Token | undefined {
    const letter = this.exp[this.index]

    if (/\s/.test(letter)) {
      return
    }
    const peek = this.exp[this.index + 1]
    // console.log(`index=${this.index} letter=${JSON.stringify(letter)} peek=${JSON.stringify(peek)}`)

    // multi_ops have to come first has some of their first characters match single_ops
    for (const multi_op of multi_ops) {
      if (letter == multi_op.letter && peek == multi_op.peek) {
        this.index++
        return {type: multi_op.type}
      }
    }

    const op = single_ops[letter]
    if (op) {
      return {type: op}
    } else if (numbers.has(letter)) {
      return this._number(letter)
    } else if (/[a-zA-Z]/.test(letter)) {
      return this._token(letter)
    } else if (letter == '"' || letter == "'") {
      return this._string(letter)
    } else {
      throw Error(`Unable to tokenize expressing at char ${this.index + 1} "${letter}"`)
    }
  }

  _number(letter: string): Token {
    let value = letter
    while (true) {
      const new_letter = this.exp[this.index + 1]
      if (!numbers.has(new_letter)) {
        return {type: 'num', value}
      }
      value += new_letter
      this.index++
    }
  }

  _token(letter: string): Token {
    let value = letter
    while (true) {
      const new_letter = this.exp[this.index + 1]
      if (!new_letter || !/[a-zA-Z_]/.test(new_letter)) {
        if (keywords.has(value as any)) {
          return {type: value as TokenType}
        } else {
          return {type: 'token', value}
        }
      }
      value += new_letter
      this.index++
    }
  }

  _string(letter: string): Token {
    let value = ''
    let new_letter = ''
    const start_pos = this.index + 1
    while (true) {
      const escape = new_letter == '\\'
      this.index++
      new_letter = this.exp[this.index]
      if (!new_letter) {
        throw Error(
          `string ${JSON.stringify(value)} started at position ${start_pos}, 
            but not closed by end of expression`,
        )
      }
      if (!escape && new_letter == letter) {
        return {type: 'string', value}
      }
      value += new_letter
    }
  }
}

export const tokenize = (exp: string): Token[] => new Tokenize(exp).tokenize()
