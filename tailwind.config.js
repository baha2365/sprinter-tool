/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#0d1012',
          900: '#14181b',
          800: '#1d2226',
          700: '#282e33',
        },
        track: {
          DEFAULT: '#FF4A2E',
          dim: '#7A2416',
          glow: '#FF7A5C',
        },
        chalk: '#F5F3EE',
        steel: '#8FA3AD',
        signal: '#2BD97C',
        flag: '#FFC24D',
      },
      fontFamily: {
        display: ['"Oswald"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
