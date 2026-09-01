/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { paper: '#f3f0e7', ink: '#11110f', signal: '#ff4a22', cobalt: '#1646d8' },
      fontFamily: {
        display: ['Arial Black', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
    },
  },
}

