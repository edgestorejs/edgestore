/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'EdgeStore',
  tagline: 'Handling images should be easy',
  url: 'https://edgestore.dev',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'edgestorejs', // Usually your GitHub org/user name.
  projectName: 'edgestore', // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/edgestorejs/edgestore/tree/main/docs',
        },
        // blog: {
        //   showReadingTime: true,
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   editUrl: 'https://github.com/edgestorejs/edgestore/tree/main/docs',
        // },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        gtag: {
          trackingID: 'G-HRW63MNKJZ',
        },
      }),
    ],
    [
      'docusaurus-preset-shiki-twoslash',
      {
        themes: ['dark-plus'],
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      metadata: [{ name: 'og:site_name', content: 'EdgeStore' }],
      image: 'img/opengraph-image.png',
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: false,
        disableSwitch: true,
      },
      algolia: {
        appId: 'ZF5MFIC7VK',
        apiKey: 'ae568f14ad13b14f4c0cc72b8e722d94',
        indexName: 'edgestore',
      },
      navbar: {
        logo: {
          alt: 'EdgeStore Logo',
          src: 'img/logo-sm.png',
        },
        items: [
          {
            type: 'doc',
            docId: 'main/quick-start',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/pricing',
            label: 'Pricing',
            position: 'right',
          },
          // { to: "/blog", label: "Blog", position: "left" },
          {
            href: 'https://dashboard.edgestore.dev',
            position: 'right',
            className: 'header-sign-in-link',
            label: 'Dashboard',
          },
          {
            href: 'https://github.com/edgestorejs/edgestore',
            position: 'right',
            className: 'header-social-link header-github-link',
            'aria-label': 'GitHub',
          },
          {
            href: 'https://discord.gg/HvrnhRTfgQ',
            position: 'right',
            className: 'header-social-link header-discord-link',
            'aria-label': 'GitHub',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Docs',
                to: '/docs/quick-start',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'YouTube',
                href: 'https://www.youtube.com/@perfectbase',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/HvrnhRTfgQ',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Terms of Service',
                href: 'https://edgestore.dev/legal/terms',
                target: '_blank',
              },
              {
                label: 'Privacy Policy',
                href: 'https://edgestore.dev/legal/privacy-policy',
                target: '_blank',
              },
              {
                label: 'Disclosure',
                to: '/legal/disclosure',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/edgestorejs/edgestore',
              },
              {
                label: '❤️ Sponsor',
                href: 'https://github.com/sponsors/perfectbase',
              },
            ],
          },
        ],
      },
    }),
  plugins: [
    function myPlugin() {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require('tailwindcss'));
          postcssOptions.plugins.push(require('autoprefixer'));
          return postcssOptions;
        },
      };
    },
    [
      'posthog-docusaurus',
      {
        apiKey: 'phc_54D1wZ850epCSU1kvSIqQOlnWtD8BGVqq1npvyAm4nS',
        appUrl: 'https://ph.edgestore.dev',
        ui_host: 'https://us.posthog.com',
        enableInDevelopment: false,
      },
    ],
  ],
};

module.exports = config;
