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
        sm: '0.1875rem',
        DEFAULT: '0.25rem',
        md: '0.25rem',
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
    },
  },
  plugins: [],
};
