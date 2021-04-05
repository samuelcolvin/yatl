import {SaxesParser} from 'saxes'

export function parse(xml: string): string[] {
  const data: string[] = []

  const parser = new SaxesParser()
  parser.on('error', (e) => console.error('ERROR:', e))
  parser.on('text', (t) => data.push(JSON.stringify(t)))
  parser.on('opentag', (n) => {
    data.push(`${n.name} (${JSON.stringify(n.attributes)}) {${n.isSelfClosing ? '}' : ''}`)
  })
  parser.on('closetag', (n) => {
    if (!n.isSelfClosing) {
      data.push(`} ${n.name}`)
    }
  })
  parser.write(xml).close()
  return data
}
