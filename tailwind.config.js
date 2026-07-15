/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a192f',
          900: '#0f1d38',
          800: '#15294a',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e6c757',
          dark: '#a07c1e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
