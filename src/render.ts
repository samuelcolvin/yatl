import type {Context, Functions} from './expressions/evaluate'
import type {TemplateElement, TagElement, ComponentElement, Text} from './parse'
import {evaluate_clause_str, evaluate_clause_bool} from './expressions'
import {Clause} from './expressions/build'

export async function render(template: TemplateElement[], context: Context, functions: Functions): Promise<string> {
  const r = new Render(template, functions)
  return await r.render(context)
}

export class Render {
  private readonly template: TemplateElement[]
  private readonly functions: Functions

  constructor(template: TemplateElement[], functions: Functions) {
    this.template = template
    this.functions = functions
  }

  async render(context: Context): Promise<string> {
    return await this.render_chunks(this.template, context)
  }

  private async render_chunks(chunks: TemplateElement[], context: Context): Promise<string> {
    let s = ''
    for (const chunk of chunks) {
      const v = await this.render_chunk(chunk, context)
      if (v) {
        s += v
      }
    }
    return s
  }

  private async render_chunk(chunk: TemplateElement, context: Context): Promise<string | null> {
    switch (chunk.type) {
      case 'text':
        return chunk.text
      case 'comment':
        return `<!--${chunk.comment}-->`
      case 'tag':
      case 'component':
        return await this.render_element(chunk, context)
      case 'doctype':
        return `<!DOCTYPE${chunk.doctype}>`
      default:
        return await evaluate_clause_str(chunk, context, this.functions)
    }
  }

  private async render_element(chunk: TagElement | ComponentElement, context: Context): Promise<string | null> {
    const if_ = chunk.if
    if (if_ != undefined) {
      const v = await evaluate_clause_bool(if_, context, this.functions)
      if (!v) {
        return null
      }
    }
    const for_ = chunk.for
    if (for_ != undefined) {
      throw new Error('TODO')
    } else {
      if (chunk.type == 'tag') {
        return await this.render_tag(chunk, context)
      } else {
        return await this.render_component(chunk, context)
      }
    }
  }

  private async render_tag(tag: TagElement, context: Context): Promise<string | null> {
    const new_context = {...context}
    const {name, body, set_attributes, attributes, fragment} = tag
    if (set_attributes) {
      for (const {name, value} of set_attributes) {
        new_context[name] = await this.evaluate_attr(value, context)
      }
    }

    if (fragment) {
      return body ? await this.render_chunks(body, new_context) : null
    }

    let attrs = ''
    if (attributes) {
      for (const {name, value} of attributes) {
        const v = await this.evaluate_attr(value, context)
        attrs += ` ${name}="${v}"`
      }
    }
    if (body) {
      const body_str = await this.render_chunks(body, new_context)
      return `<${name}${attrs}>${body_str}</${name}>`
    } else {
      return `<${name}${attrs}/>`
    }
  }

  private async render_component(comp: ComponentElement, context: Context): Promise<string> {
    const new_context = {...context}
    const {body, props, children} = comp
    if (props) {
      for (const {name, value} of props) {
        new_context[name] = await this.evaluate_attr(value, context)
      }
    }

    if (children) {
      new_context.children = await this.render_chunks(children, new_context)
    }
    return await this.render_chunks(body, new_context)
  }

  private async evaluate_attr(value: (Text | Clause)[], context: Context): Promise<string> {
    // TODO escaping
    let s = ''
    for (const chunk of value) {
      if (chunk.type == 'text') {
        s += chunk.text
      } else {
        s += await evaluate_clause_str(chunk, context, this.functions)
      }
    }
    return s
  }
}
