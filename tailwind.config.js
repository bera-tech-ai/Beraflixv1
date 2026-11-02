/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,mdx}', './components/**/*.{js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#08090D',
        surface: '#101115',
        violet: '#F0182D',
        electric: '#FF354A',
        ember: '#C80E2E',
        gold: '#FFD36E'
      },
      boxShadow: {
        violet: '0 0 36px rgba(240, 24, 45, .22)',
        blue: '0 0 32px rgba(240, 24, 45, .18)'
      }
    }
  },
  plugins: []
};
