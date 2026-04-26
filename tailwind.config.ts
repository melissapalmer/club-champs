import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rd: {
          navy: '#0B1E3F',
          'navy-deep': '#06142D',
          gold: '#B8893A',
          'gold-light': '#D4A859',
          cream: '#F6F2EA',
          ink: '#1F2937',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
