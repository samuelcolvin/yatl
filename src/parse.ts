import {SaxesParser, SaxesTagPlain, SaxesAttributeNS, StartTagForOptions, AttributeEventForOptions} from 'saxes'

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
  name: string
  value: RawText | RawBool | Template | Clause
}

interface Element {
  name: string
  attributes?: Attribute[]
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
  private readonly parser: SaxesParser
  private parents: (Element | Component)[] = []
  current!: Element | Component
  components: Record<string, Component | ExternalComponent> = {}
  private tag_col = 0
  private is_component = false
  private attrs: Attribute[] = []
  private props: Prop[] = []

  constructor(file_name: string) {
    this.current = {
      name: 'root',
      attributes: [],
      loc: {line: 1, col: 1},
      body: [],
    }
    this.parser = new SaxesParser({fileName: file_name})
    this.parser.on('error', this.on_error.bind(this))
    this.parser.on('opentagstart', this.on_opentagstart.bind(this))
    this.parser.on('attribute', this.on_attribute.bind(this))
    this.parser.on('opentag', this.on_opentag.bind(this))
    this.parser.on('closetag', this.on_closetag.bind(this))
    this.parser.on('doctype', this.on_doctype.bind(this))
    this.parser.on('text', this.on_text.bind(this))
    this.parser.on('comment', this.on_comment.bind(this))
  }

  parse(xml: string) {
    this.parser.write(xml).close()
  }

  private static on_error(e: Error): void {
    console.error('ERROR:', e)
  }

  private on_opentagstart(tag: StartTagForOptions<any>): void {
    this.tag_col = this.parser.column - tag.name.length - 1
    this.is_component = tag.name == 'template'
  }

  private on_attribute(attr: AttributeEventForOptions<any>) {
    if (this.is_component) {
      if (attr.name != 'name' && attr.name != 'id') {
        this.props.push({name: attr.name, default: attr.value})
      }
    } else {
      this.attrs.push({name: attr.name, value: {text: attr.value as string}})
    }
  }

  private on_opentag(tag: SaxesTagPlain): void {
    let new_tag: Element | Component
    const loc: FileLocation = {line: this.parser.line, col: this.tag_col}
    if (this.is_component) {
      const name: string | undefined = tag.attributes.name || tag.attributes.id
      if (!name) {
        throw Error('"name" or "id" is required for "<template>" elements to be used as components')
      }
      new_tag = {
        name,
        props: this.props,
        loc,
        body: [],
      }
      this.props = []
      this.components[name] = new_tag
    } else {
      new_tag = {
        name: tag.name,
        loc,
        body: [],
      }
      if (this.attrs.length) {
        new_tag.attributes = this.attrs
      }
      this.attrs = []
      this.current.body.push(new_tag)
    }
    this.parents.push(this.current)
    this.current = new_tag
  }

  private on_closetag(): void {
    const parent = this.parents.pop()
    if (parent) {
      this.current = parent
    } else {
      throw Error('no parent found, mis-formed XML')
    }
  }

  private on_doctype(doctype: string): void {
    if (this.parents.length) {
      throw Error('doctype can only be set on the root element')
    } else if ('props' in this.current) {
      // shouldn't happen
      throw Error("something has gone wrong, you can't set doctype on a component")
    } else {
      this.current.doctype = doctype
    }
  }

  private on_text(text: string): void {
    this.current.body.push({text})
  }

  private on_comment(comment: string): void {
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
