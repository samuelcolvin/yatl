module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', 'karma-typescript'],
    files: [
      'src/**/*.ts',
    ],
    preprocessors: {
      '**/*.ts': 'karma-typescript'
    },        
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.json',
    },
    reporters: ['progress', 'karma-typescript'],
    browsers: ['Chrome']
  })
}
