import eslint from '@eslint/js';
import eslintPluginJsdoc from 'eslint-plugin-jsdoc';
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'storybook-static/**'],
  },
  {
    files: ['**/*.{js,cjs,mjs,cts,mts,jsx,ts,tsx}'],
    plugins: {
      jsdoc: eslintPluginJsdoc,
      'simple-import-sort': eslintPluginSimpleImportSort,
      unicorn: eslintPluginUnicorn,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  tseslint.configs.recommended,
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.{ts,tsx,d.ts,mts}'],
    rules: {
      'no-unused-vars': 'off',
      // Глобалы описаны типами; необъявленное имя ловит tsc. Правило даёт
      // только ложные срабатывания.
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            FunctionDeclaration: false,
            FunctionExpression: false,
            MethodDefinition: false,
          },
          contexts: ['TSPropertySignature'],
        },
      ],
      'jsdoc/require-description': [
        /**
         * Постепенно смигрировать и включить error
         */
        'warn',
        {
          contexts: ['TSPropertySignature'],
        },
      ],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },
  {
    /**
     * Правила React живут только на `.tsx`: в `.ts` компонентов и хуков нет,
     * а `jsx-a11y` без JSX просто нечего проверять.
     */
    files: ['**/*.tsx'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'jsx-a11y': eslintPluginJsxA11y,
    },
    rules: {
      ...eslintPluginReactHooks.configs['recommended-latest'].rules,
      ...eslintPluginJsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{js,cjs,mjs,cts,mts,jsx,ts,tsx}'],
    rules: {
      'jsdoc/multiline-blocks': [
        'error',
        {
          noSingleLineBlocks: true,
          singleLineTags: [],
        },
      ],
      'arrow-body-style': ['error', 'always'],
      'arrow-parens': ['error', 'always'],
      'no-console': ['error', { allow: ['error'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^node:'],
            ['^@?\\w'],
            ['^@/'],
            ['^.+\\.s?css$'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          ],
        },
      ],
      'operator-linebreak': [
        2,
        'after',
        {
          overrides: {
            '?': 'before',
            ':': 'before',
          },
        },
      ],
      'padded-blocks': [2, 'never'],
      'no-fallthrough': [2, { allowEmptyCase: true }],
      'unicorn/switch-case-braces': ['error', 'always'],
      'padding-line-between-statements': [
        2,
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: '*',
        },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: 'directive',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'directive',
          next: 'directive',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'multiline-block-like',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: ['case', 'default'],
        },
      ],
    },
  }
);
