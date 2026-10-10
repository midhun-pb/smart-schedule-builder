/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          blue: '#0071e3',
          darkBlue: '#0077ED',
          gray: '#86868b',
          lightBg: '#f5f5f7',
          darkBg: '#0b0f19',
          cardLight: 'rgba(255, 255, 255, 0.75)',
          cardDark: 'rgba(15, 23, 42, 0.75)',
          borderLight: 'rgba(255, 255, 255, 0.4)',
          borderDark: 'rgba(255, 255, 255, 0.1)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-glow': '0 0 25px rgba(0, 113, 227, 0.25)',
      }
    },
  },
  plugins: [],
}
