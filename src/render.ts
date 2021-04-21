import type {Context, Functions} from './expressions/evaluate'
import type {TemplateElement, TagElement, ComponentElement, Text} from './parse'
import {evaluate_as_str, evaluate_as_bool, evaluate_as_loop} from './expressions'
import {Clause} from './expressions/build'

export async function render(template: TemplateElement[], context: Context, functions: Functions): Promise<string> {
  const r = new Renderer(functions)
  return await r.render(template, context)
}

export class Renderer {
  private readonly functions: Functions

  constructor(functions: Functions) {
    this.functions = functions
  }

  async render(template: TemplateElement[], context: Context): Promise<string> {
    let s = ''
    for (const chunk of template) {
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
        return await evaluate_as_str(chunk, context, this.functions)
    }
  }

  private async render_element(chunk: TagElement | ComponentElement, context: Context): Promise<string | null> {
    const if_ = chunk.if
    if (if_ != undefined) {
      const v = await evaluate_as_bool(if_, context, this.functions)
      if (!v) {
        return null
      }
    }
    const render = (context: Context) => {
      if (chunk.type == 'tag') {
        return this.render_tag(chunk, context)
      } else {
        return this.render_component(chunk, context)
      }
    }
    const for_ = chunk.for
    if (for_ == undefined) {
      return await render(context)
    } else {
      const contexts = await evaluate_as_loop(for_, chunk.for_names as string[], context, this.functions)
      let index = 1
      const parts: string[] = []
      for (const loop_names_context of contexts) {
        const loop = {
          index,
          first: index == 1,
          last: index == contexts.length,
        }
        const v = await render({...context, ...loop_names_context, loop})
        if (v) {
          parts.push(v)
        }
        index++
      }
      let join_with = '\n' + ' '.repeat(chunk.loc.col - 1)
      if (chunk.for_join) {
        join_with = await this.evaluate_attr_value(chunk.for_join, context)
      }
      return parts.join(join_with)
    }
  }

  private async render_tag(tag: TagElement, context: Context): Promise<string | null> {
    const new_context = {...context}
    const {name, body, set_attributes, attributes, fragment} = tag
    if (set_attributes) {
      for (const {name, value} of set_attributes) {
        new_context[name] = await this.evaluate_attr_value(value, context)
      }
    }

    if (fragment) {
      return body ? await this.render(body, new_context) : null
    }

    let attrs = ''
    if (attributes) {
      for (const {name, value} of attributes) {
        const v = await this.evaluate_attr_value(value, context)
        attrs += ` ${name}="${v}"`
      }
    }
    if (body) {
      const body_str = await this.render(body, new_context)
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
        new_context[name] = await this.evaluate_attr_value(value, context)
      }
    }

    if (children) {
      new_context.children = await this.render(children, new_context)
    }
    return await this.render(body, new_context)
  }

  private async evaluate_attr_value(value: (Text | Clause)[], context: Context): Promise<string> {
    // TODO escaping
    let s = ''
    for (const chunk of value) {
      if (chunk.type == 'text') {
        s += chunk.text
      } else {
        s += await evaluate_as_str(chunk, context, this.functions)
      }
    }
    return s
  }
}
