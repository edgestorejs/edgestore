/* eslint-disable */

module.exports = function tailwindPlugin() {
  return {
    name: "tailwind-plugin",
    configurePostCss(postcssOptions) {
      postcssOptions.plugins = [require("@tailwindcss/postcss")];
      return postcssOptions;
    },
  };
};