/** @type {import("eslint").Linter.Config} */
const config = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['no-only-tests', 'unicorn', 'turbo'],
  extends: [
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of import
    tsconfigRootDir: __dirname,
    project: [
      './examples/.*/*/tsconfig.json',
      './examples/*/tsconfig.json',
      './packages/*/tsconfig.json',
      './tsconfig.json',
      './docs/tsconfig.json',
    ], // Allows for the use of rules which require parserServices to be generated
  },
  // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
  rules: {
    // These rules aren't enabled in typescript-eslint's basic recommended config, but we like them
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],

    // These rules enabled in typescript-eslint's configs don't apply here
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/sort-type-constituents': 'off',

    // Todo: do we want these?
    '@typescript-eslint/no-explicit-any': 'off',

    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-only-tests/no-only-tests': 'error',
    'unicorn/filename-case': [
      'error',
      {
        case: 'camelCase',
        ignore: [
          'EdgeStore',
          '\\.config\\.js',
          '\\.d\\.ts$',
          'issue-\\d+-.*\\.test\\.tsx?$',
          '\\.(t|j)sx$',
        ],
      },
    ],
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
  },
  overrides: [
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
        // Todo: enable these for even stronger linting! 💪
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
        'packages/tests/**/*',
        '**/*.test.tsx',
        '**/*.test.ts',
      ],
      rules: {
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/naming-convention': 'off',
      },
    },
    {
      files: ['packages/**/*'],
      rules: {
        'no-console': 'error',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};

module.exports = config;
