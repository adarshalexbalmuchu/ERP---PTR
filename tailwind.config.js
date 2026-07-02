/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ptr: {
          green: '#1A4731',
          'green-light': '#2D6A4F',
          'green-dark': '#0F2E1E',
          amber: '#D97706',
          cream: '#F5F1E8',
          'cream-dark': '#EFE7D6',
          brown: '#2A2724',
          'brown-light': '#6B6356',
        },
        status: {
          notstarted: '#9CA3AF',
          progress: '#F59E0B',
          completed: '#3B82F6',
          archived: '#10B981',
          overdue: '#DC2626',
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
