import {SaxesParser, SaxesTagPlain, StartTagForOptions, AttributeEventForOptions} from 'saxes'

import type {Clause} from './expressions/build'
import {build_clause} from './expressions'

interface FileLocation {
  line: number
  col: number
}

interface TextRaw {
  text: string
}

interface Comment {
  comment: string
}

interface TextTemplate {
  template: string
  clauses: Clause[]
  loc?: FileLocation
}

interface Attribute {
  name: string
  value: TextRaw | TextTemplate | Clause
}

interface Element {
  name: string
  attributes?: Attribute[]
  body: (Comment | TextRaw | TextTemplate | Element)[]
  loc: FileLocation
  doctype?: string
}

interface Prop {
  name: string
  default?: string
}

interface ExternalComponent {
  name: string
  readonly path: string | null
}

interface Component {
  name: string
  props: Prop[]
  body: (Comment | TextRaw | TextTemplate | Element)[]
  loc: FileLocation
}

class Parser {
  private readonly parser: SaxesParser
  private parents: (Element | Component)[] = []
  current: Element | Component
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
    this.parser = new SaxesParser({fileName: file_name, fragment: true})
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

  private on_error(e: Error): void {
    console.error('ERROR:', e)
  }

  private on_opentagstart(tag: StartTagForOptions<any>): void {
    this.tag_col = this.parser.column - tag.name.length - 1
    this.is_component = tag.name == 'template'
  }

  private on_attribute(attr: AttributeEventForOptions<any>) {
    const {name, value} = attr
    if (this.is_component) {
      if (name != 'name' && name != 'id' && name != 'path') {
        // TODO allow optional empty string via `foobar:optional=""`, prevent names ending with :
        if (value == '') {
          this.props.push({name})
        } else {
          this.props.push({name, default: value})
        }
      }
    } else {
      if (name.endsWith(':')) {
        this.attrs.push({name: name.slice(0, -1), value: build_clause(value)})
      } else {
        this.attrs.push({name, value: {text: value}})
      }
    }
  }

  private on_opentag(tag: SaxesTagPlain): void {
    let new_tag: Element | Component | null = null
    const loc: FileLocation = {line: this.parser.line, col: this.tag_col}
    if (this.is_component) {
      const name: string | undefined = tag.attributes.name || tag.attributes.id
      if (!name) {
        throw Error('"name" or "id" is required for "<template>" elements to be used as components')
      }
      if (tag.isSelfClosing) {
        this.components[name] = {name, path: tag.attributes.path || null}
      } else {
        new_tag = {name, props: this.props, loc, body: []}
        this.components[name] = new_tag
      }
      this.props = []
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
    if (new_tag) {
      this.current = new_tag
    }
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
