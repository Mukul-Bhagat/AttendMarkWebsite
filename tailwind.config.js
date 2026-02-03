/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#f04129', // Red/Orange brand color (used in both modes)
        'primary-hover': '#d63a25', // Darker shade for hover states
        // Light mode colors (White & Gold theme)
        'background-light': '#f8f7f5', // Off-white background
        'surface-light': '#ffffff', // White surfaces
        'text-primary-light': '#181511', // Dark text on light background
        'text-secondary-light': '#8a7b60', // Secondary text on light background
        'border-light': '#e6e2db', // Light borders
        // Dark mode colors (Slate/Gray theme)
        'background-dark': '#0f172a', // Very deep slate (slate-900) for main background
        'surface-dark': '#1e293b', // Slate-800 for sidebar, navbar, and cards
        'text-primary-dark': '#f1f5f9', // Light slate text (slate-100)
        'text-secondary-dark': '#cbd5e1', // Secondary text (slate-300)
        'border-dark': '#334155', // Dark borders (slate-700)
      },
      fontFamily: {
        sans: ['Manrope', 'Hero New', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
}

