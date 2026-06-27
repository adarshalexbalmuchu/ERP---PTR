/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ptr: {
          green: '#1A4731',
          'green-light': '#2D6A4F',
          cream: '#F5F1E8',
          'cream-dark': '#EFE7D6',
          brown: '#2A2724',
          'brown-light': '#6B6356',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
