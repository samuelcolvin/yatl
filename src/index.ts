import {SaxesParser} from 'saxes'

export function parse(xml: string): Record<string, any>[] {
  const data: Record<string, any>[] = []

  const parser = new SaxesParser()
  parser.on('error', e => console.error('ERROR:', e))
  parser.on('doctype', doctype => data.push({doctype}))
  parser.on('text', text => data.push({text, line: parser.line, column: parser.column}))
  parser.on('opentag', tag => data.push({tag}))
  parser.on('closetag', closetag => data.push({closetag}))
  parser.write(xml).close()
  return data
}
