import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const localDesignPlugin = {
  rules: {
    'no-raw-button': {
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name && node.name.name === 'button') {
              const filename = context.filename || context.getFilename?.() || ''
              if (filename.replace(/\\/g, '/').endsWith('src/components/ui/switch.jsx') || 
                  filename.replace(/\\/g, '/').endsWith('src/components/ui/button.jsx')) {
                return
              }
              context.report({
                node,
                message: 'Raw HTML <button> is prohibited by Enterprise Design System. Use <Button variant="..."> from "@/components/ui/button".',
              })
            }
          },
        }
      },
    },
    'no-button-color-overrides': {
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name && node.name.name === 'Button') {
              const classAttr = node.attributes?.find(
                (a) => a.type === 'JSXAttribute' && a.name?.name === 'className'
              )
              if (!classAttr || !classAttr.value) return
              let classVal = ''
              if (classAttr.value.type === 'Literal' && typeof classAttr.value.value === 'string') {
                classVal = classAttr.value.value
              } else if (
                classAttr.value.type === 'JSXExpressionContainer' &&
                classAttr.value.expression?.type === 'Literal'
              ) {
                classVal = String(classAttr.value.expression.value)
              }
              if (!classVal) return

              if (
                /\bbg-(red|blue|green|emerald|indigo|slate|gray|yellow|purple)-\d+/.test(classVal) ||
                /\bbg-\[#[0-9a-fA-F]+\]/.test(classVal) ||
                /\btext-(red|green|blue|gray)-\d+/.test(classVal)
              ) {
                context.report({
                  node: classAttr,
                  message:
                    'Ad-hoc background and text color overrides on <Button> are prohibited. Use design tokens and button variants (primary, secondary, outline, ghost, destructive, link).',
                })
              }
            }
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'enterprise-design': localDesignPlugin,
    },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'enterprise-design/no-raw-button': 'error',
      'enterprise-design/no-button-color-overrides': 'error',
    },
  },
])
