/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
      colors: {
        // Primary brand blue from 14.png & 2.png
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#044eed',
          600: '#0345d0',
          700: '#023aa8',
          800: '#032e82',
          900: '#0b1a48',
          DEFAULT: '#044eed',
        },
        brand: {
          blue: '#044eed',
          navy: '#0b1a48',
          dark: '#061b6a',
        },
        // Surfaces & Canvas
        surface: {
          canvas: '#f8fafc',
          card: '#ffffff',
          sidebar: '#ffffff',
          border: '#e2e8f0',
          'border-subtle': '#f1f5f9',
        },
        // Status chip color tokens from 14.png
        status: {
          uploaded: {
            bg: '#f1f5f9',
            text: '#475569',
            dot: '#64748b',
          },
          processing: {
            bg: '#e5f1ff',
            text: '#1d4ed8',
            dot: '#2563eb',
          },
          needsReview: {
            bg: '#fef8e2',
            text: '#92400e',
            dot: '#d97706',
          },
          mismatch: {
            bg: '#feecec',
            text: '#991b1b',
            dot: '#dc2626',
          },
          approved: {
            bg: '#e4f8ef',
            text: '#166534',
            dot: '#16a34a',
          },
          rejected: {
            bg: '#feecec',
            text: '#991b1b',
            dot: '#dc2626',
          },
          failed: {
            bg: '#feecec',
            text: '#991b1b',
            dot: '#dc2626',
          },
        },
        // Confidence chip tokens from 14.png
        confidence: {
          high: {
            bg: '#e4f8ef',
            text: '#166534',
            dot: '#16a34a',
          },
          medium: {
            bg: '#fef8e2',
            text: '#92400e',
            dot: '#d97706',
          },
          low: {
            bg: '#feecec',
            text: '#991b1b',
            dot: '#dc2626',
          },
        },
        // Legacy bhu palette for backwards compatibility
        bhu: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          dark: '#0b1319',
          card: '#111e29',
          border: '#1f3647',
        }
      },
      borderRadius: {
        button: '8px',
        input: '8px',
        card: '12px',
        chip: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        dropdown: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
