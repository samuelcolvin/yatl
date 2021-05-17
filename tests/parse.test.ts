import {load_template, TemplateElement, FileLoader} from '../src/parse'
import {str2array, load_wasm} from './utils'
import each from 'jest-each'

const expected_elements: [string, TemplateElement[]][] = [
  ['<div>hello</div>', [{type: 'tag', name: 'div', loc: {line: 1, col: 1}, body: [{type: 'text', text: 'hello'}]}]],
  [
    '<div>before{{ name }}after</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [
          {type: 'text', text: 'before'},
          {type: 'var', symbol: 'name', chain: []},
          {type: 'text', text: 'after'},
        ],
      },
    ],
  ],
  [
    '<!DOCTYPE html>\n<div>foobar</div>',
    [
      {type: 'doctype', doctype: 'html'},
      {type: 'text', text: '\n'},
      {
        type: 'tag',
        name: 'div',
        loc: {line: 2, col: 1},
        body: [{type: 'text', text: 'foobar'}],
      },
    ],
  ],
  [
    '   <div>hello</div>',
    [
      {type: 'text', text: '   '},
      {type: 'tag', name: 'div', loc: {line: 1, col: 4}, body: [{type: 'text', text: 'hello'}]},
    ],
  ],
  ['<template name="Testing">foobar</template>', []],
  [
    '<div class:="1 + 2">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [{type: 'text', text: 'hello'}],
        attributes: [
          {
            name: 'class',
            value: [
              {
                type: 'operator',
                operator: '+',
                args: [
                  {type: 'num', value: 1},
                  {type: 'num', value: 2},
                ],
              },
            ],
          },
        ],
      },
    ],
  ],
  [
    '<template name="IntComponent" foo="">foo {{ foo }}</template>\n<IntComponent foo="xxx"/>',
    [
      {type: 'text', text: '\n'},
      {
        type: 'component',
        name: 'IntComponent',
        loc: {line: 2, col: 1},
        props: [{name: 'foo', value: [{type: 'text', text: 'xxx'}]}],
        body: [
          {type: 'text', text: 'foo '},
          {type: 'var', symbol: 'foo', chain: []},
        ],
        comp_file: 'root.html',
        comp_loc: {line: 1, col: 1},
      },
    ],
  ],
  [
    '<template name="CompDefault" x="1">foo {{ foo }}</template><CompDefault/>',
    [
      {
        type: 'component',
        name: 'CompDefault',
        loc: {line: 1, col: 60},
        props: [{name: 'x', value: [{type: 'text', text: '1'}]}],
        body: [
          {type: 'text', text: 'foo '},
          {type: 'var', symbol: 'foo', chain: []},
        ],
        comp_file: 'root.html',
        comp_loc: {line: 1, col: 1},
      },
    ],
  ],
  [
    '<template name="ChildrenDefault">children:{{ children }}</template>\n<ChildrenDefault>child.</ChildrenDefault>',
    [
      {type: 'text', text: '\n'},
      {
        type: 'component',
        name: 'ChildrenDefault',
        loc: {line: 2, col: 1},
        props: [],
        body: [
          {type: 'text', text: 'children:'},
          {type: 'var', symbol: 'children', chain: []},
        ],
        children: [{type: 'text', text: 'child.'}],
        comp_file: 'root.html',
        comp_loc: {line: 1, col: 1},
      },
    ],
  ],
  [
    '<template name="ExtComponent"/>\n<ExtComponent foo="xxx"/>',
    [
      {type: 'text', text: '\n'},
      {
        type: 'component',
        name: 'ExtComponent',
        loc: {line: 2, col: 1},
        props: [{name: 'foo', value: [{type: 'text', text: 'xxx'}]}],
        body: [
          {type: 'text', text: 'foo '},
          {type: 'var', symbol: 'foo', chain: []},
        ],
        comp_file: 'ExtComponent.html',
        comp_loc: {line: 1, col: 1},
      },
    ],
  ],
  [
    '<div set:x="1" set:y="2"/>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        set_attributes: [
          {name: 'x', value: [{type: 'num', value: 1}]},
          {name: 'y', value: [{type: 'num', value: 2}]},
        ],
      },
    ],
  ],
  [
    '<div>hello</div><!-- a comment-->',
    [{type: 'tag', name: 'div', loc: {line: 1, col: 1}, body: [{type: 'text', text: 'hello'}]}],
  ],
  [
    '<div if:="if_clause">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [{type: 'text', text: 'hello'}],
        if: {type: 'var', symbol: 'if_clause', chain: []},
      },
    ],
  ],
  [
    '<div for:x:="for_clause">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [{type: 'text', text: 'hello'}],
        for: {type: 'var', symbol: 'for_clause', chain: []},
        for_names: ['x'],
      },
    ],
  ],
  [
    '<div for:x="for_clause">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [{type: 'text', text: 'hello'}],
        for: {type: 'var', symbol: 'for_clause', chain: []},
        for_names: ['x'],
      },
    ],
  ],
  [
    '<div for:x:y="for_clause">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: [{type: 'text', text: 'hello'}],
        for: {type: 'var', symbol: 'for_clause', chain: []},
        for_names: ['x', 'y'],
      },
    ],
  ],
]

function get_loader(xml: string): FileLoader {
  return async (path: string) => {
    if (path == 'root.html') {
      return str2array(xml)
    } else if (path == 'ExtComponent.html') {
      return str2array('<template name="ExtComponent" foo="">foo {{ foo }}</template>')
    } else {
      throw Error(`Unknown template "${path}"`)
    }
  }
}

describe('load_template', () => {
  each(expected_elements).test('expected_elements %j', async (xml, expected_elements) => {
    const loader = get_loader(xml)
    // console.log(JSON.stringify(await load_template('root.html', loader, load_wasm), null, 2))
    expect(await load_template('root.html', loader, load_wasm)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', async () => {
  //   const new_expected_elements = []
  //   for (const [xml] of expected_elements) {
  //     const loader = get_loader(xml)
  //     const ee = await load_template('root.html', loader)
  //     new_expected_elements.push([xml, ee])
  //   }
  //   console.log('const expected_elements: [string, TemplateElement[]][] = %j', new_expected_elements)
  // })
})
