import {load_template, FileLoader} from '../src/parse'
import {render} from '../src/render'
import each from 'jest-each'
import {Context, Functions} from '../src/expressions/evaluate'

const expected_rendered: [string, string][] = [
  ['<div>hello</div>', '<div>hello</div>'],
  ['  <div>hello {{ foo }}</div>', '  <div>hello FOO</div>'],
  ['<div if:="false">xxx</div>', ''],
  ['<div set:spam:="pie()">{{ spam }}</div>', '<div>apple pie</div>'],
  [
    '<div for:thing:="an_array" for_join="">{{ thing }}</div>',
    '<div>first-element</div><div>second-element</div><div>third-element</div>',
  ],
  [
    '<div for:="an_array" for_join=".">{{ item }}</div>',
    '<div>first-element</div>.<div>second-element</div>.<div>third-element</div>',
  ],
  [
    `
      <div for:key:value="simple_object">
        {{ loop.index }} {{ key }} {{ value }}
      </div>
    `,
    `
      <div>
        1 a apple
      </div>
      <div>
        2 b banana
      </div>
      <div>
        3 c carrot
      </div>
    `,
  ],
  [
    `
<template name="MyComponent" foo="" bar="default-bar">
  <label>foo</label>: <span>{{ foo }}</span>
  <label>bar</label>: <span>{{ bar }}</span>
</template>
<MyComponent foo="FOO"/>
    `,
    `


  <label>foo</label>: <span>FOO</span>
  <label>bar</label>: <span>default-bar</span>

    `,
  ],
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
  an_array: ['first-element', 'second-element', 'third-element'],
  simple_object: {
    a: 'apple',
    b: 'banana',
    c: 'carrot',
  },
  one: 1,
}
const test_functions: Functions = {
  pie: async () => 'apple pie',
  one_argument: async (x: number) => x * 2,
}

describe('render', () => {
  each(expected_rendered).test('expected_rendered %s', async (template, expected_output) => {
    const loader = get_loader(template)
    const template_elements = await load_template('root.html', loader)
    const output = await render(template_elements, test_context, test_functions)
    // console.log('output:', output)
    // console.log('output: %j', output)
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
