// ESLint flat config: renderer (browser/JSX) and Electron main (Node/CommonJS)
// are handled separately. `npm run lint` also runs in CI.
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  // scratch/ holds local, never committed experiments (.gitignore)
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'scratch/**'] },

  js.configs.recommended,

  // Renderer: React in a browser context (Vite)
  {
    files: ['src/**/*.{js,jsx}', 'vite.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      // marks components/variables used in JSX as "used"
      'react/jsx-uses-vars': 'error',
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },

  // Node context: Electron main/preload (CommonJS)
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // Playwright: tests and the ui-shots skill run in Node, page.evaluate()
  // callbacks in the browser
  {
    files: ['e2e/**/*.mjs', 'playwright.config.mjs', '.claude/skills/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
]
