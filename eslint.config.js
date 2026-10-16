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
      // Existing migration debt is baselined by --max-warnings in package.json.
      // New violations still make the lint gate fail when the baseline grows.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // ── Dizayn v2, 3-bosqich: xabar va tasdiqlash faqat v2 primitivlari orqali ──────────────
      // Xabar — `notify` (src/shared/lib/notify.ts, `<Toaster />`); tasdiq — `useConfirm()` / `ConfirmDialog`
      // (src/shared/ui/primitives). docs/DESIGN_SYSTEM.md §8, §11.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'antd',
              importNames: ['message', 'notification'],
              message: "Dizayn v2: antd `message` / `notification` o'rniga `notify.success|info|warning|error()` (src/shared/lib/notify.ts).",
            },
            {
              name: 'antd',
              importNames: ['Popconfirm'],
              message: "Dizayn v2: `Popconfirm` o'rniga `useConfirm()` yoki `ConfirmDialog` (src/shared/ui/primitives).",
            },
          ],
          patterns: [
            {
              group: ['antd/es/message', 'antd/es/message/*', 'antd/lib/message', 'antd/lib/message/*', 'antd/es/notification', 'antd/es/notification/*', 'antd/lib/notification', 'antd/lib/notification/*', 'antd/es/popconfirm', 'antd/lib/popconfirm'],
              message: "Dizayn v2: xabar — `notify` (src/shared/lib/notify.ts), tasdiq — `useConfirm()` (src/shared/ui/primitives).",
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: "Dizayn v2: brauzer `confirm()` o'rniga `useConfirm()` (src/shared/ui/primitives)." },
        { name: 'alert', message: "Dizayn v2: brauzer `alert()` o'rniga `notify.*` (src/shared/lib/notify.ts)." },
        { name: 'prompt', message: "Dizayn v2: brauzer `prompt()` o'rniga `Dialog` + `Field`/`TextInput` (src/shared/ui/primitives)." },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'confirm', message: "Dizayn v2: `window.confirm` o'rniga `useConfirm()` (src/shared/ui/primitives)." },
        { object: 'window', property: 'alert', message: "Dizayn v2: `window.alert` o'rniga `notify.*` (src/shared/lib/notify.ts)." },
        { object: 'window', property: 'prompt', message: "Dizayn v2: `window.prompt` o'rniga `Dialog` + `Field`/`TextInput`." },
        { object: 'globalThis', property: 'confirm', message: "Dizayn v2: `confirm` o'rniga `useConfirm()` (src/shared/ui/primitives)." },
        { object: 'globalThis', property: 'alert', message: "Dizayn v2: `alert` o'rniga `notify.*` (src/shared/lib/notify.ts)." },
        { object: 'globalThis', property: 'prompt', message: "Dizayn v2: `prompt` o'rniga `Dialog` + `Field`/`TextInput` (src/shared/ui/primitives)." },
        { object: 'Modal', property: 'confirm', message: "Dizayn v2: `Modal.confirm` o'rniga `useConfirm()` (src/shared/ui/primitives)." },
        { object: 'Modal', property: 'useModal', message: "Dizayn v2: `Modal.useModal` (modal.confirm) o'rniga `useConfirm()`." },
        { object: 'App', property: 'useApp', message: "Dizayn v2: antd `App.useApp()` (message/notification/modal) o'rniga `notify` va `useConfirm()`." },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='Popconfirm']",
          message: "Dizayn v2: `Popconfirm` o'rniga `useConfirm()` yoki `ConfirmDialog` (src/shared/ui/primitives).",
        },
        {
          // `import { Modal as AntModal }` — yuqoridagi `Modal.confirm` / `Modal.info` taqiqlarini aylanib o'tadi.
          selector: "ImportDeclaration[source.value='antd'] > ImportSpecifier[imported.name='Modal'][local.name!='Modal']",
          message: "Dizayn v2: antd `Modal` ni boshqa nom bilan import qilmang — `Modal.confirm` taqig'i ishlamay qoladi. Tasdiq uchun `useConfirm()` (src/shared/ui/primitives).",
        },
        {
          selector: "CallExpression[callee.object.name='Modal'][callee.property.name=/^(info|success|error|warning)$/]",
          message: "Dizayn v2: antd `Modal.info|success|error|warning` o'rniga `notify.*` yoki `Dialog` (src/shared/ui/primitives).",
        },
      ],
    },
  },
])
