import {FileLoader, load_template, PrepareParserWasm} from './parse'
import {render_template} from './render'
import {Context, Functions} from './expressions/evaluate'
import {str2stream} from './utils'

type LaxFileLoader = (path: string) => Promise<ReadableStream | string>

async function render_string(
  template_string: string,
  context: Context,
  functions: Functions,
  prepare_parser_wasm: PrepareParserWasm,
  file_loader?: LaxFileLoader,
): Promise<string> {
  const root_path_name = 'template_string'

  const _file_loader = async (path: string): Promise<ReadableStream> => {
    if (path == root_path_name) {
      return str2stream(template_string)
    } else if (file_loader) {
      const f = await file_loader(path)
      if (typeof f == 'string') {
        return str2stream(f)
      } else {
        return f
      }
    } else {
      throw Error(
        `Unable to load template "${path}", use the 'file_loader' template argument to provide a custom file loader`,
      )
    }
  }
  const template_elements = await load_template(root_path_name, _file_loader, prepare_parser_wasm)
  return await render_template(template_elements, context, functions)
}

export {load_template, render_template, render_string, str2stream, FileLoader, LaxFileLoader, Context, Functions}
