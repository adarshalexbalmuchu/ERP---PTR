/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '420px',
      },
      colors: {
        ptr: {
          green: '#1A4731',
          'green-light': '#2D6A4F',
          'green-dark': '#123522',
          // Mid accent for links, selection tints and focus rings — reads as
          // a clear interactive green without the header's near-black depth.
          accent: '#2C7A54',
          amber: '#B26A00',
          // Legacy warm tokens kept only so any un-migrated markup still
          // resolves; the app now runs on the neutral `n` scale below.
          cream: '#F5F3F1',
          'cream-dark': '#EDEBE9',
          brown: '#201F1E',
          'brown-light': '#605E5C',
        },
        // Fluent-style warm-neutral ramp. Chrome (header aside) is built from
        // n-10/n-20; the workspace is white; n-30 is the one hairline divider
        // colour used almost everywhere.
        n: {
          0: '#FFFFFF',
          10: '#FAF9F8',
          20: '#F3F2F1',
          30: '#EDEBE9',
          40: '#E1DFDD',
          50: '#D2D0CE',
          60: '#C8C6C4',
          70: '#A19F9D',
          80: '#605E5C',
          90: '#3B3A39',
          100: '#201F1E',
        },
        // Two signal colours only. Red is reserved for urgent/overdue; amber
        // for the softer "in progress / due soon" cue.
        signal: {
          red: '#B10E1C',
          'red-bg': '#FDF3F4',
          amber: '#B26A00',
          green: '#1A7F4B',
        },
      },
      fontFamily: {
        // Segoe UI on Windows (native Fluent), Inter as the cross-platform
        // match, then the system stack. No decorative display face.
        sans: [
          'Segoe UI',
          'Inter',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Slightly tightened defaults for a dense operational tool.
        '13': ['13px', { lineHeight: '18px' }],
      },
      borderRadius: {
        // Everything caps at 6px — flattens existing rounded-xl/2xl usage to
        // the Fluent 4–6px range without touching every call site.
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '6px',
        xl: '6px',
        '2xl': '6px',
        '3xl': '6px',
        full: '9999px',
      },
      boxShadow: {
        // One restrained elevation for genuine overlays (menus, dialogs).
        // No large ambient shadows on inline surfaces.
        card: '0 1px 2px rgba(32, 31, 30, 0.06)',
        pop: '0 4px 16px -4px rgba(32, 31, 30, 0.18), 0 1px 3px rgba(32, 31, 30, 0.10)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
