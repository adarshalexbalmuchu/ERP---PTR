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
        // A deliberately restrained status palette — three signal colors
        // (neutral / brand green / red) instead of a different saturated
        // hue per state. Always paired with a text label, never
        // color-alone, per the muted "government portal" direction.
        status: {
          notstarted: '#9CA3AF',
          progress: '#8A7F5C',
          completed: '#1A4731',
          archived: '#9CA3AF',
          overdue: '#DC2626',
        },
        // Muted signal colors for large dashboard numerals — quieter than
        // the status palette, per the institutional/enterprise direction.
        signal: {
          crimson: '#9F1D1D',
          slate: '#47566B',
        },
      },
      fontFamily: {
        // IBM Plex Sans — institutional/administrative feel (IBM Carbon,
        // GDS-adjacent). Poppins kept as fallback during font load.
        sans: ['IBM Plex Sans', 'Poppins', 'system-ui', 'sans-serif'],
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
