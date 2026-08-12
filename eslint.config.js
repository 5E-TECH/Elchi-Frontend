import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Disables stylistic rules that would fight Prettier.
      prettier,
    ],
    plugins: {
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // `any` is being migrated out of the data layer; keep it visible, not blocking.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow intentionally-unused `_`-prefixed args/vars/catch bindings.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // The data layer wraps useQuery in `getX` helpers (and a couple of large
      // components confuse the component heuristic). Runtime-safe but violates the
      // hook naming convention — surfaced as warnings pending a getX→useX migration.
      'react-hooks/rules-of-hooks': 'warn',
      // React Compiler advisory rules — this project doesn't use the compiler, so
      // treat its opinions as warnings rather than build-blocking errors.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-refresh/only-export-components': 'warn',

      // Import ordering — large existing surface, clean up gradually.
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
        },
      ],

      // Accessibility — curated high-value rules as warnings (internal admin tool).
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/no-redundant-roles': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
    },
  },
])
