import type { Config } from 'tailwindcss';

// Colours come from CSS variables defined in src/index.css.
// Defaults match Royal Durban; src/theme.ts overrides them at runtime
// from course.json -> branding.colors.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rd: {
          navy: c('rd-navy'),
          'navy-deep': c('rd-navy-deep'),
          gold: c('rd-gold'),
          'gold-light': c('rd-gold-light'),
          cream: c('rd-cream'),
          ink: c('rd-ink'),
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
