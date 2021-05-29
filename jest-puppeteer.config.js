module.exports = {
  launch: {
    dumpio: true,
    headless: process.env.HEADLESS !== 'false',
    product: 'chrome',
    incognito: true,
  },
  browserContext: 'default',
}
