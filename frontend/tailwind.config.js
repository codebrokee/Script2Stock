/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Flat keys so utilities read bg-surface / text-primary / border-subtle.
        // (Nested `bg: { surface }` would generate the doubled `bg-bg-surface`.)
        base: '#0b0b0f',
        surface: '#131318',
        elevated: '#1c1c23',
        inset: '#0f0f14',
        subtle: '#23232c',
        strong: '#2f2f3a',
        primary: '#ececf1',
        secondary: '#a1a1aa',
        tertiary: '#71717a',
        accent: {
          DEFAULT: '#7c5cff',
          hover: '#6d4ce8',
          soft: '#1e1a33',
          text: '#b4a3ff'
        },
        success: {
          DEFAULT: '#34d399',
          soft: '#0d281f'
        },
        warn: {
          DEFAULT: '#fbbf24',
          soft: '#2a1f08'
        },
        danger: {
          DEFAULT: '#fb7185',
          soft: '#2b1019'
        }
      },
      borderRadius: {
        card: '10px',
        control: '8px',
        pill: '999px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.4)',
        lift: '0 8px 24px rgba(0, 0, 0, 0.45)',
        focus: '0 0 0 2px #0b0b0f, 0 0 0 4px #7c5cff'
      }
    }
  },
  plugins: []
};
