/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig*/
/** @typedef  {import("prettier").Config} PrettierConfig*/
/** @typedef  {{ tailwindConfig: string }} TailwindConfig*/

/** @type { PrettierConfig | SortImportsConfig | TailwindConfig } */
const config = {
  printWidth: 80,
  trailingComma: 'all',
  endOfLine: 'auto',
  singleQuote: true,
  importOrder: ['___', '__', '<THIRD_PARTY_MODULES>', '^[./]'],
  tailwindStylesheet: './docs/src/css/custom.css',
  plugins: [
    require.resolve('@ianvs/prettier-plugin-sort-imports'),
    /**
     * Tailwind plugin must come last!
     */
    require.resolve('prettier-plugin-tailwindcss'),
  ],
};

module.exports = config;
