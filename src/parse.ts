import {SaxesParser, SaxesTagPlain, SaxesAttributeNS} from 'saxes'

import type {Clause} from './expressions/build'

interface FileLocation {
  line: number
  col: number
}

interface RawText {
  text: string
}

interface RawBool {
  bool: boolean
}

interface Comment {
  comment: string
}

interface Template {
  template: string
  clauses: Clause[]
  loc?: FileLocation
}

interface Attribute {
  key: string
  value: RawText | RawBool | Template | Clause
}

interface Element {
  name: string
  attributes: Attribute[]
  body: (Comment | RawText | Template | Element)[]
  loc: FileLocation
  doctype?: string
}

interface Prop {
  name: string
  default?: string
}

interface ExternalComponent {
  name: string
  path: string
}

interface Component {
  name: string
  props: Prop[]
  body: (Comment | RawText | Template | Element)[]
  loc: FileLocation
}

class Parser {
  _parser: SaxesParser
  _parents: (Element | Component)[] = []
  current!: Element | Component
  components: (Component | ExternalComponent)[] = []

  constructor(file_name: string) {
    this.current = {
      name: 'root',
      attributes: [],
      loc: {line: 1, col: 1},
      body: [],
    }
    this._parser = new SaxesParser({fileName: file_name})
    this._parser.on('error', this._on_error.bind(this))
    this._parser.on('opentag', this._on_opentag.bind(this))
    this._parser.on('closetag', this._on_closetag.bind(this))
    this._parser.on('doctype', this._on_doctype.bind(this))
    this._parser.on('text', this._on_text.bind(this))
    this._parser.on('comment', this._on_comment.bind(this))
  }

  parse(xml: string) {
    this._parser.write(xml).close()
  }

  _on_error(e: Error): void {
    console.error('ERROR:', e)
  }

  _loc = (): FileLocation => ({line: this._parser.line, col: this._parser.column + 1})

  _on_opentag(tag: SaxesTagPlain): void {
    let new_tag: Element | Component
    if (tag.name == 'template') {
      const name: string | undefined = tag.attributes.name || tag.attributes.id
      if (!name) {
        throw Error('"name" or "id" is required for "<template>" elements to be used as components')
      }
      new_tag = {
        name,
        props: [],
        loc: this._loc(),
        body: [],
      }
      this.components.push(new_tag)
    } else {
      new_tag = {
        name: tag.name,
        attributes: Object.entries(tag.attributes).map(([k, v]) => this._map_attributes(k, v)),
        loc: this._loc(),
        body: [],
      }
      this.current.body.push(new_tag)
    }
    this._parents.push(this.current)
    this.current = new_tag
  }

  _map_attributes(key: string, value: string | SaxesAttributeNS): Attribute {
    return {
      key,
      value: {text: value as string},
    }
  }

  _on_closetag(tag: SaxesTagPlain): void {
    const parent = this._parents.pop()
    if (parent) {
      this.current = parent
    } else {
      throw Error('no parent found, mis-formed XML')
    }
  }

  _on_doctype(doctype: string): void {
    if (this._parents.length) {
      throw Error('doctype can only be set on the root element')
    } else if ('props' in this.current) {
      // shouldn't happen
      throw Error("something has gone wrong, you can't set doctype on a component")
    } else {
      this.current.doctype = doctype
    }
  }

  _on_text(text: string): void {
    this.current.body.push({text})
  }

  _on_comment(comment: string): void {
    // TODO starts with "keep:"
    this.current.body.push({comment})
  }
}

export function parse_file(file_name: string, xml: string): any {
  const parser = new Parser(file_name)
  parser.parse(xml)
  return {
    body: parser.current.body,
    components: parser.components,
  }
}
