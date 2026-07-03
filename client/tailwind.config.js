/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Existing blue brand (keeps all current pages unchanged) ──
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },

        // ── Livplus Maroon ramp ──
        maroon: {
          50:  '#FCEBEC',
          100: '#F7D2D4',
          200: '#EBA3A7',
          300: '#DB6A70',
          400: '#B83740',
          500: '#8E1820',
          600: '#710F16',  // primary brand
          700: '#5A0C12',
          800: '#4A0A0E',
          900: '#350709',
        },

        // ── Livplus Ink ramp (warm neutral) ──
        ink: {
          50:  '#FAF7F6',
          100: '#F1ECEA',
          200: '#E4DEDC',
          300: '#C4BDBA',
          400: '#9B9491',
          500: '#78716E',
          600: '#5C5755',
          700: '#44403F',
          800: '#2F2B2C',
          900: '#231F20',
        },

        // ── Livplus semantic palette ──
        lp: {
          success:    '#1E7A52',
          'success-bg': '#E3F4EC',
          warning:    '#9A5B05',
          'warning-bg': '#FBEFD9',
          danger:     '#A11B1B',
          'danger-bg': '#FBEAEA',
          info:       '#0C5C8C',
          'info-bg':  '#E4F0F8',
        },
      },

      fontFamily: {
        sans:    ['Sarabun', 'Prompt', 'system-ui', 'sans-serif'],
        body:    ['Sarabun', 'Prompt', 'system-ui', 'sans-serif'],
        display: ['Kanit', 'Sarabun', 'system-ui', 'sans-serif'],
      },

      animation: {
        'pulse-ring': 'pulse-ring 2.2s ease-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(199,22,32,.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(199,22,32,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(199,22,32,0)' },
        },
      },
    },
  },
  plugins: [],
};
