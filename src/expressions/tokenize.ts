const token_types = [
  '(',
  ')',
  '[',
  ']',
  ',',
  '.',
  '+',
  '-',
  '/',
  '*',
  '|',
  '!',
  '==',
  '!=',
  '||',
  '&&',
  '.?',
  'in',
  '!in',
  'true',
  'false',
  'num',
  'symbol',
  'str',
] as const
export type TokenType = typeof token_types[number]

const multi_ops: Set<TokenType> = new Set(['==', '!=', '||', '&&', '.?'])

const single_ops: Set<TokenType> = new Set(['(', ')', '[', ']', ',', '.', '+', '-', '/', '*', '|', '!'])
const keywords: Record<string, TokenType> = {
  in: 'in',
  true: 'true',
  True: 'true',
  false: 'false',
  False: 'false',
  or: '||',
  and: '&&',
  not: '!',
}

export interface Token {
  readonly type: TokenType
  readonly value?: string | number
}

const numbers = new Set('1234567890')

class Tokenize {
  private readonly exp: string
  private index: number

  constructor(exp: string) {
    this.exp = exp.trim()
    this.index = 0
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (this.index < this.exp.length) {
      const t = this.get_token()
      if (t) {
        if (t.type == 'in' && tokens.length > 0 && tokens[tokens.length - 1].type == '!') {
          tokens[tokens.length - 1] = {type: '!in'}
        } else {
          tokens.push(t)
        }
      }
      this.index++
    }
    return tokens
  }

  private get_token(): Token | undefined {
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
      return this.number(letter)
    } else if (/[a-zA-Z]/.test(letter)) {
      return this.symbol(letter)
    } else if (letter == '"' || letter == "'") {
      return this.string(letter)
    } else {
      throw Error(`Unable to tokenize expressing at char ${this.index + 1} "${letter}"`)
    }
  }

  private number(letter: string): Token {
    let value = letter
    while (true) {
      const new_letter = this.exp[this.index + 1]
      if (new_letter == '_') {
        // allow underscores but ignore them
        this.index++
      } else if (numbers.has(new_letter)) {
        value += new_letter
        this.index++
      } else if (new_letter == '.') {
        if (value.includes('.')) {
          throw Error('numbers may not contain more than one dot')
        }
        if (!numbers.has(this.exp[this.index + 2])) {
          throw Error('numbers may not end with a dot')
        }
        value += new_letter
        this.index++
      } else {
        // the number has ended, return it
        return {type: 'num', value: parseFloat(value)}
      }
    }
  }

  private symbol(letter: string): Token {
    let value = letter
    while (true) {
      const new_letter = this.exp[this.index + 1]
      if (!new_letter || !/[a-zA-Z_]/.test(new_letter)) {
        const keyword_type = keywords[value]
        if (keyword_type) {
          return {type: keyword_type}
        } else {
          return {type: 'symbol', value}
        }
      }
      value += new_letter
      this.index++
    }
  }

  private string(letter: string): Token {
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
        return {type: 'str', value}
      }
      value += new_letter
    }
  }
}

export default (exp: string): Token[] => new Tokenize(exp).tokenize()
