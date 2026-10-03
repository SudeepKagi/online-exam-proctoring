module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'test',
        'docs',
        'chore',
        'build',
        'ci',
        'refactor',
        'style',
        'revert'
      ]
    ],
    'subject-case': [0]
  }
}
