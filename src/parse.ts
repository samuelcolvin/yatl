import {SaxesParser, SaxesTagPlain, StartTagForOptions, AttributeEventForOptions} from 'saxes'

import {is_upper_case} from './utils'
import type {Clause} from './expressions/build'
import {build_clause} from './expressions'

interface FileLocation {
  readonly line: number
  readonly col: number
}

interface TextRaw {
  readonly text: string
}

interface Comment {
  readonly comment: string
}

interface TextTemplate {
  readonly template: string
  readonly clauses: Clause[]
  readonly loc: FileLocation
}

interface Attribute {
  readonly name: string
  readonly value: TextRaw | TextTemplate | Clause
}

export type Body = (Comment | TextRaw | TextTemplate | Element)[]

interface Element {
  readonly name: string
  readonly loc: FileLocation
  readonly attributes: Attribute[]
  readonly body: Body
  doctype?: string
  component?: Component | ExternalComponent
}

interface Prop {
  readonly name: string
  readonly default?: string
}

interface ExternalComponent {
  readonly name: string
  path: string | null
  used: boolean
}

interface Component {
  readonly name: string
  readonly props: Prop[]
  readonly body: Body
  readonly loc: FileLocation
}

type FileComponents = {[key: string]: Component | ExternalComponent}

class FileParser {
  private readonly parser: SaxesParser
  private parents: (Element | Component)[] = []
  current: Element | Component
  components: FileComponents = {}
  private external_component_tags: Element[] = [] // elements referencing external components
  private tag_col = 0
  private is_component = false
  private attributes: Attribute[] = []
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

  check() {
    /**
     * check the validity of the template, in particular:
     * - check tags match the props of their component where applicable
     */
    for (const tag of this.external_component_tags) {
      const component = tag.component as Component | ExternalComponent
      if ('props' in component) {
        this.check_missing_props(tag.name, component, tag.attributes)
      } else {
        throw Error(`Component ${tag.name} not loaded`)
      }
    }
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
        this.attributes.push({name: name.slice(0, -1), value: build_clause(value)})
      } else {
        this.attributes.push({name, value: {text: value}})
      }
    }
  }

  private on_opentag(tag: SaxesTagPlain): void {
    let new_tag: Element | Component | null = null
    const loc: FileLocation = {line: this.parser.line, col: this.tag_col}
    if (this.is_component) {
      const name: string | undefined = tag.attributes.name || tag.attributes.id
      if (!name) {
        throw Error('"name" or "id" is required for "<template>" elements when creating components')
      }
      if (!/^[A-Z][a-zA-Z0-9]+$/.test(name)) {
        throw Error('component names must be CamelCase: start with a capital, contain only letters and numbers')
      }
      if (tag.isSelfClosing) {
        this.components[name] = {name, path: tag.attributes.path || null, used: false}
      } else {
        new_tag = {name, props: this.props, loc, body: []}
        this.components[name] = new_tag
      }
      this.props = []
    } else {
      const name = tag.name
      let component: Component | ExternalComponent | null = null
      let external = false
      if (is_upper_case(name.substr(0, 1))) {
        // assume this is a component
        component = this.components[name] || null
        if (!component) {
          throw Error(
            `"${name}" appears to be component and is not defined or imported in this file. ` +
              `Either define the component or, if you meant to refer to a standard HTML tag, use the lower case name.`,
          )
        }
        if ('props' in component) {
          this.check_missing_props(name, component, this.attributes)
        } else {
          external = true
          component.used = true
        }
      }
      new_tag = {name: name, loc, body: [], attributes: this.attributes}
      if (component) {
        new_tag.component = component
        if (external) {
          this.external_component_tags.push(new_tag)
        }
      }

      this.attributes = []
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

  private check_missing_props(name: string, component: Component, tag_attrs: Attribute[]): void {
    const attr_names = new Set(tag_attrs.map(a => a.name))
    const missing_props = component.props.filter(p => !p.default && !attr_names.has(p.name)).map(p => p.name)
    if (missing_props.length) {
      throw Error(`The following properties were omitted when calling ${name}: ${missing_props.join(', ')}`)
    }
  }
}

export type FileLoader = (path: string) => Promise<string>

class TemplateLoader {
  base_file_path: string
  file_loader: FileLoader

  constructor(file_path: string, file_loader: FileLoader) {
    this.base_file_path = file_path
    this.file_loader = file_loader
  }

  async load(): Promise<Body> {
    const parser = await this.parse_file(this.base_file_path)
    parser.check()
    return parser.current.body
  }

  private async parse_file(file_path: string): Promise<FileParser> {
    const xml = await this.file_loader(file_path)
    const parser = new FileParser(file_path)
    parser.parse(xml)
    await this.load_external_components(parser.components)
    return parser
  }

  private async load_external_components(components: FileComponents): Promise<void> {
    const req_components = Object.entries(components).filter(([, c]) => ('used' in c) && c.used)
    const req_files: {[path: string]: Set<string>} = {}
    for (const [name, component] of req_components) {
      const path = (component as ExternalComponent).path || `${name}.html`
      if (path in req_files) {
        req_files[path].add(name)
      } else {
        req_files[path] = new Set([name])
      }
    }
    const imported_components: FileComponents[] = await Promise.all(Object.entries(req_files).map(pc => this.load_file_components(...pc)))
    for (const new_file_components of imported_components) {
      for (const [name, component] of Object.entries(new_file_components)) {
        const new_comp: any = Object.assign(components[name], component as Component)
        delete new_comp.path
        delete new_comp.used
      }
    }
  }

  private async load_file_components(file_path: string, components: Set<string>): Promise<FileComponents> {
    const parser = await this.parse_file(file_path)
    // TODO check all components are defined and raise an error if not
    return Object.fromEntries(Object.entries(parser.components).filter(([k,]) => components.has(k)))
  }
}


export async function load_base_template(file_path: string, file_loader: FileLoader): Promise<Body> {
  const loader = new TemplateLoader(file_path, file_loader)
  return loader.load()
}
