/* eslint-disable */

module.exports = function tailwindPlugin() {
  return {
    name: 'docusaurus-tailwindcss',
    configurePostCss(postcssOptions) {
      // Appends TailwindCSS and AutoPrefixer.
      postcssOptions.plugins.push(require('tailwindcss'));
      postcssOptions.plugins.push(require('autoprefixer'));
      return postcssOptions;
    },
  };
};
