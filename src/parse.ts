import {
  Attribute as SaxAttribute,
  Detail as SaxDetail,
  Position,
  SaxEventType as SaxET,
  SAXParser,
  Tag as SaxTag,
  Text as SaxText,
} from 'sax-wasm'
import {is_upper_case, remove_undefined} from './utils'
import type {Clause} from './expressions/build'
import {build_clause} from './expressions'

interface Attribute {
  readonly name: string
  readonly value: (Text | Clause)[]
}

export interface TagElement {
  readonly type: 'tag'
  readonly name: string
  readonly loc: FileLocation
  readonly fragment?: boolean
  readonly set_attributes?: Attribute[]
  readonly attributes?: Attribute[]
  readonly body?: TemplateElement[]
  readonly if?: Clause
  readonly for?: Clause
  readonly for_names?: string[]
  readonly for_join?: (Text | Clause)[]
}

interface Prop {
  readonly name: string
  readonly value: (Text | Clause)[]
}

export interface ComponentElement {
  readonly type: 'component'
  readonly name: string
  readonly loc: FileLocation
  readonly props: Prop[]
  readonly if?: Clause
  readonly for?: Clause
  readonly for_names?: string[]
  readonly for_join?: (Text | Clause)[]
  readonly body: TemplateElement[]
  readonly children?: TemplateElement[]
  readonly comp_file: string
  readonly comp_loc: FileLocation
}

export type TemplateElement = DocType | Text | Clause | TagElement | ComponentElement
export type FileLoader = (path: string) => Promise<ReadableStream>
export type PrepareParserWasm = (parser: SAXParser) => Promise<void>

export async function load_template(
  file_path: string,
  file_loader: FileLoader,
  prepare_parser_wasm: PrepareParserWasm,
): Promise<TemplateElement[]> {
  const loader = new TemplateLoader(file_path, file_loader)
  const chunks = await loader.load(prepare_parser_wasm)
  return chunks.map(convert_chunk)
}

class TemplateLoader {
  private readonly sax_parser: SAXParser
  base_file_path: string
  file_loader: FileLoader

  constructor(file_path: string, file_loader: FileLoader) {
    this.base_file_path = file_path
    this.file_loader = file_loader
    const options = {highWaterMark: 32 * 1024} // 32k chunks
    const events = SaxET.Attribute | SaxET.CloseTag | SaxET.OpenTag | SaxET.Text | SaxET.Doctype
    this.sax_parser = new SAXParser(events, options)
  }

  async load(prepare_parser_wasm: PrepareParserWasm): Promise<TempChunk[]> {
    await prepare_parser_wasm(this.sax_parser)
    const parser = await this.parse_file(this.base_file_path)
    return parser.current.body
  }

  private async parse_file(file_path: string): Promise<FileParser> {
    const file_parser = new FileParser(file_path)
    this.sax_parser.eventHandler = file_parser.handler
    const stream = await this.file_loader(file_path)
    const reader = stream.getReader()

    while (true) {
      const {done, value} = await reader.read()
      if (done) {
        this.sax_parser.end()
        await this.load_external_components(file_parser.components)
        return file_parser
      } else {
        this.sax_parser.write(value)
      }
    }
  }

  private async load_external_components(components: FileComponents): Promise<void> {
    const req_components = Object.entries(components).filter(([, c]) => 'used' in c && c.used)
    const req_files: {[path: string]: Set<string>} = {}
    for (const [name, component] of req_components) {
      const path = (component as ComponentReference).path || `${name}.html`
      if (path in req_files) {
        req_files[path].add(name)
      } else {
        req_files[path] = new Set([name])
      }
    }
    const imported_components: FileComponents[] = await Promise.all(
      Object.entries(req_files).map(pc => this.load_file_components(...pc)),
    )
    for (const new_file_components of imported_components) {
      for (const [name, component] of Object.entries(new_file_components)) {
        // modify the component in place to convert it from a ComponentReference to as ComponentDefinition
        const new_comp: any = Object.assign(components[name], component)
        delete new_comp.path
        delete new_comp.used
      }
    }
  }

  private async load_file_components(file_path: string, components: Set<string>): Promise<FileComponents> {
    const parser = await this.parse_file(file_path)
    // TODO check all components are defined here and raise an error if not
    return Object.fromEntries(Object.entries(parser.components).filter(([k]) => components.has(k)))
  }
}

export interface DocType {
  readonly type: 'doctype'
  readonly doctype: string
}

export interface Text {
  readonly type: 'text'
  readonly text: string
}

interface PropDef {
  readonly name: string
  readonly default?: string
}

interface ComponentReference {
  readonly path: string | null
  used: boolean
}

interface FileLocation {
  readonly line: number
  readonly col: number
}

export interface ComponentDefinition {
  readonly props: PropDef[]
  readonly body: TempChunk[]
  readonly file: string
  readonly loc: FileLocation
}

interface AttributeDef {
  readonly name: string
  readonly set_name?: string
  readonly for_names?: string[]
  readonly value: (Text | Clause)[]
}

interface TempElement {
  readonly type: 'temp_element'
  readonly name: string
  readonly loc: FileLocation
  readonly attributes: AttributeDef[]
  readonly body: TempChunk[]
  component?: ComponentDefinition | ComponentReference
}

export type TempChunk = DocType | Text | Clause | TempElement

type FileComponents = {[key: string]: ComponentDefinition | ComponentReference}

const illegal_names = new Set(['set', 'for', 'if'])

class FileParser {
  private readonly file_name: string
  private parents: (TempElement | ComponentDefinition)[] = []
  current: TempElement | ComponentDefinition
  readonly components: FileComponents = {}

  constructor(file_name: string) {
    this.file_name = file_name
    this.current = {
      type: 'temp_element',
      name: 'root',
      attributes: [],
      loc: {line: 1, col: 1},
      body: [],
    }
    this.handler = this.handler.bind(this)
  }

  handler(event: SaxET, data: SaxDetail): void {
    switch (event) {
      case SaxET.OpenTag:
        this.on_open_tag(data as SaxTag)
        return
      case SaxET.CloseTag:
        this.on_close_tag()
        return
      case SaxET.Text:
        this.on_text(data as SaxText)
        return
      case SaxET.Doctype:
        this.on_doctype(data as SaxText)
        return
      case SaxET.Attribute:
        // processed by on_open_tag
        return
      default:
        throw Error(
          `Internal Error: got unexpected type ${sax_type_name(event)}, ${JSON.stringify((data as any).toJSON())}`,
        )
    }
  }

  private on_open_tag(tag: SaxTag): void {
    let {name} = tag
    let new_tag: TempElement | ComponentDefinition | null
    if (name.toLowerCase() == 'template') {
      new_tag = this.on_component(tag)
    } else {
      let component: ComponentDefinition | ComponentReference | undefined = undefined
      if (name == '') {
        name = 'fragment'
      } else if (is_upper_case(name[0])) {
        // assume this is a component
        component = this.components[name]
        if (!component) {
          throw Error(
            `"${name}" appears to be component and is not defined or imported in this file. ` +
              `Either define the component or, if you meant to refer to a standard HTML tag, use the lower case name.`,
          )
        }
        if (!('props' in component)) {
          component.used = true
        }
      }
      const attributes = tag.attributes.map(a => this.prepare_attr(a))
      new_tag = {type: 'temp_element', name, loc: pos2loc(tag.openStart), body: [], attributes}
      if (component) {
        new_tag.component = component
      }

      this.current.body.push(new_tag)
    }

    this.parents.push(this.current)
    if (new_tag) {
      this.current = new_tag
    }
  }

  private on_close_tag(): void {
    const parent = this.parents.pop()
    if (parent) {
      this.current = parent
    } else {
      throw Error('no parent found, mis-formed XML')
    }
  }

  private on_text(text: SaxText): void {
    this.current.body.push(...this.parse_string(text.value))
  }

  private on_doctype(doctype: SaxText): void {
    this.current.body.push({type: 'doctype', doctype: doctype.value})
  }

  private on_component(tag: SaxTag): ComponentDefinition | null {
    let component_name: string | null = null
    let path: string | null = null
    const props: PropDef[] = []

    for (const attr of tag.attributes) {
      const name = attr.name.value
      const raw_value = attr.value.value
      if (name == 'name' || name == 'id') {
        component_name = raw_value
      } else if (name == 'path') {
        path = raw_value
      } else {
        // TODO allow optional empty string via `foobar:optional=""`, prevent names ending with :
        if (illegal_names.has(name)) {
          throw new Error(`"${name}" is not allowed as a component property name`)
        }
        if (raw_value == '') {
          props.push({name})
        } else {
          props.push({name, default: raw_value})
        }
      }
    }

    if (!component_name) {
      throw Error('"name" or "id" is required for "<template>" elements when creating components')
    } else if (!/^[A-Z][a-zA-Z0-9]+$/.test(component_name)) {
      throw Error('component names must be CamelCase: start with a capital, contain only letters and numbers')
    }
    if (component_name in this.components) {
      throw Error(`Component ${component_name} already defined`)
    }

    if (tag.selfClosing) {
      // a ComponentReference
      this.components[component_name] = {path, used: false}
      return null
    } else {
      // a ComponentDefinition
      return (this.components[component_name] = {props, body: [], file: this.file_name, loc: pos2loc(tag.openStart)})
    }
  }

  private prepare_attr(attr: SaxAttribute): AttributeDef {
    const name = attr.name.value
    const raw_value = attr.value.value
    if (!name.includes(':')) {
      if (illegal_names.has(name)) {
        throw new Error(`"${name}" is an illegal name, you might have missed a colon at the end of the name`)
      }
      return {name, value: this.parse_string(raw_value)}
    }

    const value = [build_clause(raw_value)]
    if (name.startsWith('set:')) {
      const set_name = name.substr(4).replace(/:+$/, '')
      return {name: 'set', set_name, value}
    } else if (name.startsWith('if:')) {
      return {name: 'if', value}
    } else if (name.startsWith('for:')) {
      let for_names: string[]
      if (name == 'for:') {
        for_names = ['item']
      } else {
        for_names = name.substr(4).replace(/:+$/, '').split(':')
        if (!for_names.every(n => n.length > 0)) {
          throw new Error(`Empty names are not allowed in "for" expressions, got ${JSON.stringify(for_names)}`)
        }
      }
      return {name: 'set', for_names, value}
    } else {
      if (/^[^:]:$/.test(name)) {
        throw new Error(`Invalid name "${name}"`)
      }
      return {name: name.slice(0, -1), value}
    }
  }

  private parse_string(text: string): (Text | Clause)[] {
    let chunk_end = text.indexOf('{{')
    // if "{{" is not found in the rest of the string, indexOf returns -1
    // this check is specifically to speed up the case where no '{{' is found
    if (chunk_end == -1) {
      if (text) {
        return [{type: 'text', text}]
      } else {
        return []
      }
    }
    let chunk_start = 0
    const parts: (Text | Clause)[] = []
    while (true) {
      parts.push({type: 'text', text: text.substr(chunk_start, chunk_end - chunk_start)})

      let string_start: string | null = null
      for (let index = chunk_end + 2; index < text.length; index++) {
        const letter = text[index]
        if (!string_start) {
          // not (yet) inside a string inside the clause
          if (letter == '}' && text[index - 1] == '}') {
            // found the end of the expression!
            const clause = text.substr(chunk_end + 2, index - chunk_end - 3)
            parts.push(build_clause(clause))
            chunk_start = index + 1
            break
          } else if (letter == '"' || letter == "'") {
            string_start = letter
          }
        } else if (letter == string_start && text[index - 1] != '\\') {
          // end of this substring
          string_start = null
        }
      }
      chunk_end = text.indexOf('{{', chunk_start)
      if (chunk_end == -1) {
        break
      }
    }
    parts.push({type: 'text', text: text.slice(chunk_start)})
    return parts.filter(p => !(p.type == 'text' && !p.text))
  }
}

const pos2loc = (p: Position): FileLocation => ({line: p.line + 1, col: p.character + 1})

const sax_type_name = (event: SaxET): string => {
  for (const [name, value] of Object.entries(SaxET)) {
    if (event == value) {
      return name
    }
  }
  return 'Unknown'
}

function convert_element(el: TempElement): TagElement | ComponentElement {
  const {name, loc, component} = el
  const fragment = name == 'text' || name == 'fragment'

  const set_attributes: Attribute[] = []
  const attributes: Attribute[] = []
  let _if: Clause | undefined
  let _for: Clause | undefined
  let for_names: string[] | undefined
  let for_join: (Text | Clause)[] | undefined
  for (const attr of el.attributes) {
    const {value} = attr
    const attr_name = attr.name
    if ('set_name' in attr) {
      set_attributes.push({name: attr.set_name as string, value})
    } else if ('for_names' in attr) {
      _for = one_clause(value, 'for')
      for_names = attr.for_names as string[]
    } else if (attr_name == 'for_join') {
      for_join = value
    } else if (attr_name == 'if') {
      _if = one_clause(value, 'if')
    } else {
      if (fragment) {
        throw new Error(`Standard attributes (like "${attr_name}") make no sense with ${name} elements`)
      }
      attributes.push({name: attr_name, value})
    }
  }

  const el_body = el.body.length ? el.body.map(convert_chunk) : undefined
  if (component === undefined) {
    return {
      type: 'tag',
      name,
      fragment: fragment || undefined,
      loc,
      set_attributes: set_attributes.length ? set_attributes : undefined,
      body: el_body,
      attributes: attributes.length ? attributes : undefined,
      if: _if,
      for: _for,
      for_names,
      for_join,
    }
  } else {
    if ('path' in component) {
      throw Error(`Internal Error: Component reference "${el.name}" found after loading template`)
    } else if (set_attributes.length) {
      throw new Error('"set:" style attributes not permitted on components')
    }
    const attr_lookup = Object.fromEntries(attributes.map(attr => [attr.name, attr.value]))
    return {
      type: 'component',
      name: el.name,
      loc: el.loc,
      props: component.props.map(
        (p: PropDef): Prop => {
          const {name} = p
          const attr = attr_lookup[p.name]
          if (attr) {
            return {name, value: attr}
          } else {
            if (p.default === undefined) {
              throw Error(`The required property "${name}" was not providing when calling ${el.name}`)
            } else {
              return {name, value: [{type: 'text', text: p.default}]}
            }
          }
        },
      ),
      if: _if,
      for: _for,
      for_names,
      for_join,
      body: component.body.map(convert_chunk),
      children: el_body,
      comp_file: component.file,
      comp_loc: component.loc,
    }
  }
}

function one_clause(value: (Text | Clause)[], attr: string): Clause {
  if (value.length != 1) {
    throw new Error(`One Clause is required as the value for ${attr} attributes`)
  }
  const first = value[0]
  if (first.type == 'text') {
    throw new Error(`Text values are not valid as ${attr} values`)
  } else {
    return first
  }
}

function convert_chunk(chunk: TempChunk): TemplateElement {
  if (chunk.type == 'temp_element') {
    return remove_undefined(convert_element(chunk))
  } else {
    return chunk
  }
}
