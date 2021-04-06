const numbers = new Set('1234567890')

export type TokenType =
  | '('
  | ')'
  | '['
  | ']'
  | ','
  | '.'
  | '+'
  | '-'
  | '/'
  | '*'
  | '|'
  | '!'
  | '=='
  | '!='
  | '||'
  | '&&'
  | '.?'
  | 'in'
  | 'num'
  | 'token'
  | 'string'

const multi_ops: Set<TokenType> = new Set(['==', '!=', '||', '&&', '.?'])

const single_ops: Set<TokenType> = new Set(['(', ')', '[', ']', ',', '.', '+', '-', '/', '*', '|', '!'])
const keywords: Record<string, TokenType> = {
  in: 'in',
  or: '||',
  and: '&&',
  not: '!',
}

export interface Token {
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
    const two_letters = (letter + this.exp[this.index + 1]) as TokenType
    // console.log(`index=${this.index} letter=${JSON.stringify(letter)} next=${JSON.stringify(next)}`)

    // multi_ops have to come first has some of their first characters match single_ops
    if (multi_ops.has(two_letters)) {
      this.index++
      return {type: two_letters}
    }

    if (single_ops.has(letter as TokenType)) {
      return {type: letter as TokenType}
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
        const keyword_type = keywords[value]
        if (keyword_type) {
          return {type: keyword_type}
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

export default (exp: string): Token[] => new Tokenize(exp).tokenize()
