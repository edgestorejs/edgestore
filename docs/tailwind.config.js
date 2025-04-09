// eslint-disable-next-line @typescript-eslint/no-var-requires
const theme = require('./src/lib/theme.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false, // disable Tailwind's reset
  },
  content: ['./src/**/*.{js,jsx,ts,tsx}', '../docs/**/*.mdx'], // my markdown stuff is in ../docs, not /src
  darkMode: ['class', '[data-theme="dark"]'], // hooks into docusaurus' dark mode settigns
  theme: {
    extend: {
      colors: {
        primary: theme.primary,
        background: 'hsl(222.2, 84%, 4.9%)',
        foreground: 'hsl(210, 40%, 98%)',
        border: 'hsl(217.2, 32.6%, 17.5%)',
        input: 'hsl(217.2, 32.6%, 17.5%)',
        ring: 'hsl(217.2, 32.6%, 17.5%)',
        secondary: {
          DEFAULT: 'hsl(217.2, 32.6%, 17.5%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        destructive: {
          DEFAULT: 'hsl(0, 62.8%, 30.6%)',
          foreground: 'hsl(0, 85.7%, 97.3%)',
          light: 'hsl(358, 100%, 69%)',
        },
        muted: {
          DEFAULT: 'hsl(217.2, 32.6%, 17.5%)',
          foreground: 'hsl(215, 20.2%, 65.1%)',
        },
        accent: {
          DEFAULT: 'hsl(217.2, 32.6%, 17.5%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        popover: {
          DEFAULT: 'hsl(222.2, 84%, 4.9%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        card: {
          DEFAULT: 'hsl(222.2, 84%, 4.9%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
