import {load_base_template} from '../src/parse'
import each from 'jest-each'

const expected_elements: [string, any][] = [
  [
    '<div>hello</div>',
    {body: [{name: 'div', loc: {line: 1, col: 1}, attributes: [], body: [{text: 'hello'}]}], components: {}},
  ],
  [
    '   <div>hello</div>',
    {
      body: [{text: '   '}, {name: 'div', loc: {line: 1, col: 4}, attributes: [], body: [{text: 'hello'}]}],
      components: {},
    },
  ],
  [
    '<template name="Testing">foobar</template>',
    {body: [], components: {Testing: {name: 'Testing', props: [], loc: {line: 1, col: 1}, body: [{text: 'foobar'}]}}},
  ],
  [
    '<template name="MyComponent" foobar="">foobar {{ foobar }}</template>\n\n<div>more</div>',
    {
      body: [{text: '\n\n'}, {name: 'div', loc: {line: 3, col: 1}, attributes: [], body: [{text: 'more'}]}],
      components: {
        MyComponent: {
          name: 'MyComponent',
          props: [{name: 'foobar'}],
          loc: {line: 1, col: 1},
          body: [{text: 'foobar {{ foobar }}'}],
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
          used: false,
        },
      },
    },
  ],
  [
    '<template name="UseComponent" foo="">foo {{ foo }}</template>\n<UseComponent foo="xxx"/>',
    {
      body: [
        {text: '\n'},
        {
          name: 'UseComponent',
          loc: {line: 2, col: 1},
          body: [],
          attributes: [{name: 'foo', value: {text: 'xxx'}}],
          component: {
            name: 'UseComponent',
            props: [{name: 'foo'}],
            loc: {line: 1, col: 1},
            body: [{text: 'foo {{ foo }}'}],
          },
        },
      ],
      components: {
        UseComponent: {
          name: 'UseComponent',
          props: [{name: 'foo'}],
          loc: {line: 1, col: 1},
          body: [{text: 'foo {{ foo }}'}],
        },
      },
    },
  ],
  [
    '<template name="UseExComponent"/>\n<UseExComponent foo="xxx"/>',
    {
      body: [
        {text: '\n'},
        {
          name: 'UseExComponent',
          loc: {line: 2, col: 1},
          body: [],
          attributes: [{name: 'foo', value: {text: 'xxx'}}],
          component: {
            name: 'UseExComponent',
            path: null,
            used: true,
          },
        },
      ],
      components: {
        UseExComponent: {
          name: 'UseExComponent',
          path: null,
          used: true,
        },
      },
    },
  ],
]

describe('load_base_template', () => {
  each(expected_elements).test('expected_elements %j', (xml, expected_elements) => {
    // console.log(JSON.stringify(load_base_template('testing.html', xml), null, 2))
    expect(load_base_template('testing.html', xml)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', () => {
  //   const new_expected_elements = expected_elements.map(v => [v[0], load_base_template('', v[0])])
  //   console.log('const expected_elements: [string, any][] = %j', new_expected_elements)
  // })
})
