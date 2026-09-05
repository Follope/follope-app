/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF7A00',
          dark: '#D65D00',
          light: '#FF9933',
        },
        background: '#0A0A0A',
        card: '#121212',
        border: '#242424',
        muted: '#6B6B6B',
      },
    },
  },
  plugins: [],
};
