import {FileLoader, load_template} from './parse'
import {render_template} from './render'
import {Context, Functions} from './expressions/evaluate'

async function render_string(
  template_string: string,
  context: Context,
  functions: Functions,
  file_loader?: FileLoader,
): Promise<string> {
  const root_path_name = '__root__.html'

  const _file_loader = async (path: string) => {
    if (path == root_path_name) {
      return template_string
    } else if (file_loader) {
      return await file_loader(path)
    } else {
      throw Error(
        `Unable to load template "${path}", use the 'file_loader' template argument to provide a custom file loader`,
      )
    }
  }
  const template_elements = await load_template(root_path_name, _file_loader)
  return await render_template(template_elements, context, functions)
}

export {load_template, render_template, render_string, FileLoader, Context, Functions}
