import {FileLoader, load_template, PrepareParserWasm} from './parse'
import {render_template} from './render'
import {Context, Functions} from './expressions/evaluate'

type LaxFileLoader = (path: string) => Promise<Uint8Array | string>

async function render_string(
  template_string: string,
  context: Context,
  functions: Functions,
  prepare_parser_wasm: PrepareParserWasm,
  file_loader?: LaxFileLoader,
): Promise<string> {
  const root_path_name = 'template_string'

  const _file_loader = async (path: string): Promise<Uint8Array> => {
    if (path == root_path_name) {
      return str2ab(template_string)
    } else if (file_loader) {
      const f = await file_loader(path)
      if (typeof f == 'string') {
        return str2ab(f)
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

function str2ab(str: string): Uint8Array {
  // should work with both browsers and node, might not be fast but shouldn't be used if performance matters
  const buf = new ArrayBuffer(str.length)
  const array = new Uint8Array(buf)
  const str_length = str.length
  for (let i = 0; i < str_length; i++) {
    array[i] = str.charCodeAt(i)
  }
  return array
}

export {load_template, render_template, render_string, str2ab, FileLoader, LaxFileLoader, Context, Functions}
