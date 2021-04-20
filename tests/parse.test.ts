import {load_template, TemplateElements, FileLoader} from '../src/parse'
import each from 'jest-each'

const expected_elements: [string, TemplateElements][] = [
  ['<div>hello</div>', [{type: 'tag', name: 'div', loc: {line: 1, col: 1}, body: ['hello']}]],
  [
    '<div>before{{ name }}after</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: ['before', {type: 'var', symbol: 'name', chain: []}, 'after'],
      },
    ],
  ],
  ['   <div>hello</div>', ['   ', {type: 'tag', name: 'div', loc: {line: 1, col: 4}, body: ['hello']}]],
  ['<template name="Testing">foobar</template>', []],
  [
    '<div class:="1 + 2">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: ['hello'],
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
      '\n',
      {
        type: 'component',
        name: 'IntComponent',
        loc: {line: 2, col: 1},
        props: [{name: 'foo', value: ['xxx']}],
        body: ['foo ', {type: 'var', symbol: 'foo', chain: []}],
        comp_file: 'root.html',
        comp_loc: {line: 1, col: 1},
      },
    ],
  ],
  [
    '<template name="ExtComponent"/>\n<ExtComponent foo="xxx"/>',
    [
      '\n',
      {
        type: 'component',
        name: 'ExtComponent',
        loc: {line: 2, col: 1},
        props: [{name: 'foo', value: ['xxx']}],
        body: ['foo ', {type: 'var', symbol: 'foo', chain: []}],
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
  ['<div>hello</div><!-- a comment-->', [{type: 'tag', name: 'div', loc: {line: 1, col: 1}, body: ['hello']}]],
  [
    '<div>hello</div><!-- keep: a comment-->',
    [{type: 'tag', name: 'div', loc: {line: 1, col: 1}, body: ['hello']}, {comment: ' a comment'}],
  ],
  [
    '<div if:="if_clause">hello</div>',
    [
      {
        type: 'tag',
        name: 'div',
        loc: {line: 1, col: 1},
        body: ['hello'],
        if: {type: 'var', symbol: 'if_clause', chain: []},
      },
    ],
  ],
]

function get_loader(xml: string): FileLoader {
  return async (path: string) => {
    if (path == 'root.html') {
      return xml
    } else if (path == 'ExtComponent.html') {
      return '<template name="ExtComponent" foo="">foo {{ foo }}</template>'
    } else {
      throw Error(`Unknown template "${path}"`)
    }
  }
}

describe('load_template', () => {
  each(expected_elements).test('expected_elements %j', async (xml, expected_elements) => {
    const loader = get_loader(xml)
    // console.log(JSON.stringify(await load_template('root.html', loader), null, 2))
    expect(await load_template('root.html', loader)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', async () => {
  //   const new_expected_elements = []
  //   for (const [xml] of expected_elements) {
  //     const loader = get_loader(xml)
  //     const ee = await load_template('root.html', loader)
  //     new_expected_elements.push([xml, ee])
  //   }
  //   console.log('const expected_elements: [string, TemplateElements][] = %j', new_expected_elements)
  // })
})
