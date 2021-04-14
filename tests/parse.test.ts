import {parse_file} from '../src/parse'
import each from 'jest-each'

const expected_elements: [string, any][] = [
  ['<div>hello</div>', {body: [{name: 'div', loc: {line: 1, col: 1}, body: [{text: 'hello'}]}], components: {}}],
  [
    '   <div>hello</div>',
    {body: [{text: '   '}, {name: 'div', loc: {line: 1, col: 4}, body: [{text: 'hello'}]}], components: {}},
  ],
  [
    '<template name="Testing">foobar</template>',
    {body: [], components: {Testing: {name: 'Testing', props: [], loc: {line: 1, col: 1}, body: [{text: 'foobar'}]}}},
  ],
  [
    '<template name="MyComponent" foobar="">foobar {{ x }}</template>\n\n<div>more</div>',
    {
      body: [{text: '\n\n'}, {name: 'div', loc: {line: 3, col: 1}, body: [{text: 'more'}]}],
      components: {
        MyComponent: {
          name: 'MyComponent',
          props: [{name: 'foobar'}],
          loc: {line: 1, col: 1},
          body: [{text: 'foobar {{ x }}'}],
        },
      },
    },
  ],
  [
    '<div class:="1 + 2">hello</div>',
    {
      body: [
        {
          name: 'div',
          loc: {line: 1, col: 1},
          body: [{text: 'hello'}],
          attributes: [
            {
              name: 'class',
              value: {
                type: 'operator',
                operator: '+',
                args: [
                  {type: 'num', value: 1},
                  {type: 'num', value: 2},
                ],
              },
            },
          ],
        },
      ],
      components: {},
    },
  ],
  [
    '<template name="Testing" path="path/to/component"/>',
    {
      body: [],
      components: {
        Testing: {
          name: 'Testing',
          path: 'path/to/component',
        },
      },
    },
  ],
]

describe('parse_file', () => {
  each(expected_elements).test('expected_elements %j', (xml, expected_elements) => {
    expect(parse_file('testing.html', xml)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', () => {
  //   const new_expected_elements = expected_elements.map(v => [v[0], parse_file('', v[0])])
  //   console.log('const expected_elements: [string, any][] = %j', new_expected_elements)
  //   // console.log(JSON.stringify(new_expected_elements, null, 2))
  // })
})
