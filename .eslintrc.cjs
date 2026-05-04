module.exports = {
  root: true,
  env: {
    browser: false,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['src/renderer/**/*.{ts,tsx}'],
      env: { browser: true, node: false },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      plugins: ['@typescript-eslint', 'react', 'react-hooks'],
      settings: { react: { version: 'detect' } },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@anthropic-ai/*'],
                message: 'The Anthropic SDK must only be used in the main process.',
              },
              {
                group: ['better-sqlite3', 'drizzle-orm/better-sqlite3*'],
                message: 'Database access must only happen in the main process.',
              },
              {
                group: ['electron'],
                message: 'Use the contextBridge API (window.api) instead of importing electron directly in the renderer.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['*.cjs'],
      env: { node: true },
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
    {
      files: ['e2e/**/*.ts'],
      env: { node: true },
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
  ],
  ignorePatterns: ['out/', 'dist/', 'node_modules/', '*.d.ts'],
}
