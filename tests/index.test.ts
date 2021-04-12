import {parse} from '../src'

describe('tokenize', () => {
  it('works', () => {
    expect(parse.name).toEqual('parse')
    const d = parse(`
    <foo x="y" a:b="42" c:="3">
      <bar/>
      spam
      <apple>apple content</apple>
    </foo>
`)
    console.log('d: %o', d)
  })
})
