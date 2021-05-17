import {render_string, Context, Functions} from '../src'
import each from 'jest-each'

const expected_rendered: [string, string][] = [
  ['<div>hello</div>', '<div>hello</div>'],
  ['  <div>hello {{ foo }}</div>', '  <div>hello FOO</div>'],
  ['<div if:="false">xxx</div>', ''],
  ['<text>hello</text>', 'hello'],
  ['<div id="egg" class:="foo">xxx</div>', '<div id="egg" class="FOO">xxx</div>'],
  ['<input id="egg" class:="double_it(2)"/>', '<input id="egg" class="4"/>'],
  ['<!doctype html>\n<html>lower doctype</html>', '<!DOCTYPE html>\n<html>lower doctype</html>'],
  [
    '<!-- this is a hidden comment -->\n\n<!-- and another -->',
    '\n\n',
  ],
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
  ['<span for:x:y="array_array" for_join="">{{ x }}.{{ y }}</span>', '<span>1.2</span><span>10.20</span>'],
  ['<span for:x:y="obj_array" for_join="">{{ x }}.{{ y }}</span>', '<span>3.4</span><span>5.6</span>'],
  ['<fragment for:x="simple_object" for_join=""> {{ x }}</fragment>', ' apple banana carrot'],
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
  [
    `
<!doctype html>
<html lang="en" class="no-js">
  <head>
    <meta charset="utf-8"/>
    <title>TITLE</title>
  </head>
  <body>
    <h1>hello</h1>
  </body>
</html>
`,
    `<!DOCTYPE html>
<html lang="en" class="no-js">
  <head>
    <meta charset="utf-8"/>
    <title>TITLE</title>
  </head>
  <body>
    <h1>hello</h1>
  </body>
</html>
`,
  ],
]

const test_context: Context = {
  foo: 'FOO',
  an_array: ['first-element', 'second-element', 'third-element'],
  array_array: [
    [1, 2],
    [10, 20],
  ],
  obj_array: [
    {x: 3, y: 4},
    {x: 5, y: 6},
  ],
  simple_object: {
    a: 'apple',
    b: 'banana',
    c: 'carrot',
  },
  one: 1,
}
const test_functions: Functions = {
  pie: async () => 'apple pie',
  double_it: async (x: number) => x * 2,
}

describe('render', () => {
  each(expected_rendered).test('expected_rendered %s', async (template, expected_output) => {
    const output = await render_string(template, test_context, test_functions)
    // console.log('output:', output)
    // console.log('output: %j', output)
    expect(output).toEqual(expected_output)
  })

  // test('create-expected_rendered', async () => {
  //   const new_expected_rendered = []
  //   for (const [template] of expected_rendered) {
  //     const output = await render_string(template, test_context, test_functions)
  //     new_expected_rendered.push([template, output])
  //   }
  //   console.log('const expected_rendered: [string, string][] = %j', new_expected_rendered)
  // })
})
