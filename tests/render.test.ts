import {load_template, FileLoader} from '../src/parse'
import {render} from '../src/render'
import each from 'jest-each'
import {Context, Functions} from '../src/expressions/evaluate'

const expected_rendered: [string, string][] = [
  ['<div>hello</div>', '<div>hello</div>'],
  ['<div>hello {{ foo }}</div>', '<div>hello FOO</div>'],
  ['<div if:="false">xxx</div>', ''],
  ['<div set:spam:="pie()">{{ spam }}</div>', '<div>apple pie</div>'],
]

function get_loader(xml: string): FileLoader {
  return async (path: string) => {
    if (path == 'root.html') {
      return xml
    } else {
      throw Error(`Unknown template "${path}"`)
    }
  }
}
const test_context: Context = {
  foo: 'FOO',
  a: {
    b: 'b-value',
    c: {
      d: 'd-value',
      e: {f: 'f-value'},
    },
  },
  an_array: ['first-element', 'second-element', 'third-element'],
  one: 1,
}
const test_functions: Functions = {
  pie: async () => 'apple pie',
  one_argument: async (x: number) => x * 2,
}

describe('render', () => {
  each(expected_rendered).test('expected_rendered %j -> %j', async (template, expected_output) => {
    const loader = get_loader(template)
    const template_elements = await load_template('root.html', loader)
    const output = await render(template_elements, test_context, test_functions)
    // console.log(JSON.stringify(await render('root.html', loader), null, 2))
    expect(output).toEqual(expected_output)
  })

  // test('create-expected_rendered', async () => {
  //   const new_expected_rendered = []
  //   for (const [template] of expected_rendered) {
  //     const loader = get_loader(template)
  //     const template_elements = await load_template('root.html', loader)
  //     const output = await render(template_elements, test_context, test_functions)
  //     new_expected_rendered.push([template, output])
  //   }
  //   console.log('const expected_rendered: [string, string][] = %j', new_expected_rendered)
  // })
})
