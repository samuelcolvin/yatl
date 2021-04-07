module.exports = {
  root: true,
  ignorePatterns: ['/lib/**/*'],
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  globals: {
    enz: true,
    xhr_calls: true,
  },
  extends: ['typescript', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-constant-condition': 'off',
  },
}
