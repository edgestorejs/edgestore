/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig*/
/** @typedef  {import("prettier").Config} PrettierConfig*/
/** @typedef  {{ tailwindConfig: string }} TailwindConfig*/

const sortImportsPlugin =
  require.resolve('@ianvs/prettier-plugin-sort-imports');
const tailwindPlugin = require.resolve('prettier-plugin-tailwindcss');

/** @type { PrettierConfig | SortImportsConfig | TailwindConfig } */
const config = {
  printWidth: 80,
  trailingComma: 'all',
  endOfLine: 'auto',
  singleQuote: true,
  importOrder: ['___', '__', '<THIRD_PARTY_MODULES>', '^[./]'],
  tailwindStylesheet: './docs/src/app/global.css',
  tailwindFunctions: ['tw', 'cn'],
  // Tailwind plugin must come last.
  plugins: [sortImportsPlugin, tailwindPlugin],
  overrides: [
    {
      // Keep markdown format-on-save focused on markdown itself.
      files: ['**/*.md', '**/*.mdx'],
      options: {
        embeddedLanguageFormatting: 'off',
        importOrder: [],
      },
    },
  ],
};

module.exports = config;
