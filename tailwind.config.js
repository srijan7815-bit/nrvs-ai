/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Design System: Colors (Dark) ──
        bg: '#0F0F0F',
        surface: '#1A1A1A',
        surface2: '#202020',
        border: '#2A2A2A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#B3B3B3',
        'text-tertiary': '#8A8A8A',
        'accent-blue': '#4A90E2',
        'accent-orange': '#FF8A3D',
        danger: '#FF6B6B',
        'toggle-on': '#4A90E2',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // Serif used for the big "Good afternoon" greeting in the screenshots
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      fontSize: {
        // ── Typography scale ──
        'heading-lg': ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        'heading-md': ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
        pill: '9999px',
      },
      maxWidth: {
        content: '1200px',
      },
      spacing: {
        sidebar: '280px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        slideIn: 'slideIn 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        fadeIn: 'fadeIn 200ms ease',
      },
    },
  },
  plugins: [],
}
