/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#2563eb', soft: '#eff6ff', strong: '#1d4ed8' },
        success: { DEFAULT: '#16a34a', soft: '#f0fdf4', strong: '#15803d' },
        warn: { DEFAULT: '#d97706', soft: '#fffbeb', strong: '#b45309' },
        danger: { DEFAULT: '#dc2626', soft: '#fef2f2', strong: '#b91c1c' },
        surface: { DEFAULT: '#ffffff', muted: '#f3f4f6' }
      }
    }
  },
  plugins: []
};
