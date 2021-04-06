import tokenize from '../src/tokenize'

describe('tokenize', () => {
  it('string', () => {
    expect(tokenize('"foobar"')).toEqual([{type: 'string', value: 'foobar'}])
    expect(tokenize("'foobar'")).toEqual([{type: 'string', value: 'foobar'}])
    expect(tokenize("'foo\"bar'")).toEqual([{type: 'string', value: 'foo"bar'}])
  })

  it('var', () => {
    expect(tokenize('bang')).toEqual([{type: 'token', value: 'bang'}])
    expect(tokenize('ba_ng')).toEqual([{type: 'token', value: 'ba_ng'}])
  })

  it('keyword', () => {
    expect(tokenize('in')).toEqual([{type: 'in'}])
    expect(tokenize('and')).toEqual([{type: 'and'}])
  })

  it('simple equals expression', () => {
    const tokens = [{type: 'token', value: 'abc'}, {type: 'equals'}, {type: 'num', value: '1'}]
    expect(tokenize('abc == 1')).toEqual(tokens as any)
    expect(tokenize('abc==1')).toEqual(tokens as any)
  })

  it('in expression', () => {
    expect(tokenize('12 in apple')).toEqual([
      {type: 'num', value: '12'},
      {type: 'in'},
      {type: 'token', value: 'apple'},
    ])
  })
})
