import {load_base_template, Body, FileLoader} from '../src/parse'
import each from 'jest-each'

const expected_elements: [string, Body][] = [
  ['<div>hello</div>', [{name: 'div', loc: {line: 1, col: 1}, body: ['hell'], attributes: []}]],
  [
    '<div>before{{ name }}after</div>',
    [
      {
        name: 'div',
        loc: {line: 1, col: 1},
        body: ['before', {type: 'var', symbol: 'name', chain: []}, 'after'],
        attributes: [],
      },
    ],
  ],
  ['   <div>hello</div>', ['  ', {name: 'div', loc: {line: 1, col: 4}, body: ['hell'], attributes: []}]],
  ['<template name="Testing">foobar</template>', []],
  [
    '<div class:="1 + 2">hello</div>',
    [
      {
        name: 'div',
        loc: {line: 1, col: 1},
        body: ['hell'],
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
      {
        name: 'IntComponent',
        loc: {line: 2, col: 1},
        body: [],
        attributes: [{name: 'foo', value: ['xx']}],
        component: {
          props: [{name: 'foo'}],
          body: ['foo ', {type: 'var', symbol: 'foo', chain: []}],
          file: 'root.html',
          loc: {line: 1, col: 1},
        },
      },
    ],
  ],
  [
    '<template name="ExtComponent"/>\n<ExtComponent foo="xxx"/>',
    [
      {
        name: 'ExtComponent',
        loc: {line: 2, col: 1},
        body: [],
        attributes: [{name: 'foo', value: ['xx']}],
        component: {
          props: [{name: 'foo'}],
          body: ['foo ', {type: 'var', symbol: 'foo', chain: []}],
          file: 'ExtComponent.html',
          loc: {line: 1, col: 1},
        },
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

describe('load_base_template', () => {
  each(expected_elements).test('expected_elements %j', async (xml, expected_elements) => {
    const loader = get_loader(xml)
    // console.log(JSON.stringify(await load_base_template('root.html', loader), null, 2))
    expect(await load_base_template('root.html', loader)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', async () => {
  //   const new_expected_elements = []
  //   for (const [xml,] of expected_elements) {
  //     const loader = get_loader(xml)
  //     const ee = await load_base_template('root.html', loader)
  //     new_expected_elements.push([xml, ee])
  //   }
  //   console.log('const expected_elements: [string, Body][] = %j', new_expected_elements)
  // })
})
