import react from '@eslint-react/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import reactHooks from 'eslint-plugin-react-hooks';
import turbo from 'eslint-plugin-turbo';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/.astro/**',
      '**/.next/**',
      '**/.source/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/dist/**',
      '**/*.gen.ts',
      '**/*.gen.tsx',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  react.configs.jsx,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
        project: [
          './examples/.*/*/tsconfig.json',
          './examples/*/tsconfig.json',
          './packages/*/tsconfig.json',
          './tsconfig.json',
          './docs/tsconfig.json',
        ],
      },
    },
    plugins: {
      'no-only-tests': noOnlyTests,
      turbo,
      unicorn,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/sort-type-constituents': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          leadingUnderscore: 'allow',
          custom: {
            regex: '^(T|\\$)[A-Z][a-zA-Z]+[0-9]*$',
            match: true,
          },
        },
      ],
      'max-params': ['error', 3],
      'no-only-tests/no-only-tests': 'error',
      '@eslint-react/no-component-will-mount': 'error',
      '@eslint-react/no-component-will-receive-props': 'error',
      '@eslint-react/no-component-will-update': 'error',
      '@eslint-react/no-direct-mutation-state': 'error',
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/no-unsafe-component-will-mount': 'warn',
      '@eslint-react/no-unsafe-component-will-receive-props': 'warn',
      '@eslint-react/no-unsafe-component-will-update': 'warn',
      '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
      '@eslint-react/dom-no-find-dom-node': 'error',
      '@eslint-react/dom-no-render-return-value': 'error',
      '@eslint-react/dom-no-unknown-property': 'error',
      '@eslint-react/dom-no-unsafe-target-blank': 'warn',
      '@eslint-react/dom-no-void-elements-with-children': 'error',
      'turbo/no-undeclared-env-vars': 'warn',
      'unicorn/filename-case': [
        'error',
        {
          case: 'camelCase',
          ignore: [
            'EdgeStore',
            '\\.config\\.js',
            '\\.d\\.ts$',
            '\\.test-d\\.ts$',
            'issue-\\d+-.*\\.test\\.tsx?$',
            'test-utils',
            '\\.(t|j)sx$',
          ],
        },
      ],
    },
  },
  {
    files: ['docs/**/*'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: ['examples/**/*', 'packages/*/**/*', 'scripts/**/*', 'www/**/*'],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['examples/**/*'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: [
      '**/test/**/*',
      '**/test-d/**/*',
      'packages/tests/**/*',
      '**/*.test.tsx',
      '**/*.test.ts',
    ],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: ['packages/**/*'],
    rules: {
      'no-console': 'error',
    },
  },
);
