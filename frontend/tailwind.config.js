/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6C5CE7', 50: '#f3f0ff', 100: '#e9e1ff', 200: '#d4caff', 300: '#b59fff', 400: '#9673ff', 500: '#6C5CE7', 600: '#5a3dd4', 700: '#4833b5', 800: '#3b2b96', 900: '#322680' },
        secondary: { DEFAULT: '#00CEC9', 500: '#00CEC9' },
        accent: { DEFAULT: '#FD79A8', 500: '#FD79A8' },
        background: '#0D0D1A',
        surface: '#1A1A2E',
        surface2: '#252542',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0B0',
        success: '#00B894',
        error: '#FF6B6B',
        warning: '#FDCB6E',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
