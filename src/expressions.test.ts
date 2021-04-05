import {tokenize} from './expressions'

describe('tokenize', () => {
  it('simple equals expression', () => {
    const tokens = [{type: 'var', value: 'abc'}, {type: 'equals'}, {type: 'num', value: '1'}]
    expect(tokenize('abc == 1')).toEqual(tokens as any)
    expect(tokenize('abc==1')).toEqual(tokens as any)
  })
  it('bare string', () => {
    expect(tokenize('"foobar"')).toEqual([{ type: 'string', value: 'foobar'}])
  })
  it('bare var', () => {
    expect(tokenize('bang')).toEqual([{ type: 'var', value: 'bang'}])
  })
})
