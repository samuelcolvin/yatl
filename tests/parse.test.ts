import {parse_file} from '../src/parse'
import each from 'jest-each'

const expected_elements: [string, any][] = [
  [
    '<div>hello</div>',
    {body: [{name: 'div', attributes: [], loc: {line: 1, col: 1}, body: [{text: 'hello'}]}], components: {}},
  ],
  [
    '  <template name="Testing">foobar</template>',
    {body: [], components: {'Testing': {name: 'Testing', props: [], loc: {line: 1, col: 3}, body: [{text: 'foobar'}]}}},
  ],
]

describe('parse_file', () => {
  each(expected_elements).test('expected_elements %s', (xml, expected_elements) => {
    expect(parse_file('testing.html', xml)).toStrictEqual(expected_elements)
  })

  // test('create-expected_elements', () => {
  //   const new_expected_elements = expected_elements.map(v => [v[0], parse_file('', v[0])])
  //   console.log('const expected_elements: [string, any][] = %j', new_expected_elements)
  // })
})
