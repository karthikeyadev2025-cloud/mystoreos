import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Injected via vite.config.js `define` at build time.
        __BUILD_STAMP__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // These three landed as errors in eslint-plugin-react-hooks v6 and
      // flag long-standing patterns all over the dashboards. Mechanically
      // "fixing" them (e.g. deferring setState out of effect bodies) changes
      // render/effect timing and caused real regressions. Kept as warnings so
      // they stay visible and can be addressed deliberately, one call site at
      // a time, with the behaviour actually verified — not silenced in bulk.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Node-executed config/build/test/API files — not part of the browser bundle.
    files: [
      'vite.config.js',
      'playwright.config.js',
      'api/**/*.js',
      'scripts/**/*.js',
      'tests/**/*.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
])
