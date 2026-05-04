/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Direction D — Vibrant Warm
        warm: {
          orange: '#FF9644',
          peach: '#FFCE99',
          pink: '#FFB3C6',
          brown: '#562F00',
          cream: '#FFFDF1',
        },
      },
      backgroundImage: {
        'warm-gradient': 'linear-gradient(135deg, #FF9644 0%, #FFCE99 50%, #FFB3C6 100%)',
      },
      boxShadow: {
        warm: '0 1px 3px rgba(0,0,0,0.06), 0 4px 18px rgba(0,0,0,0.09)',
        'warm-h': '0 4px 12px rgba(0,0,0,0.10), 0 10px 32px rgba(0,0,0,0.14)',
        'warm-glow': '0 3px 12px rgba(255,150,68,0.38)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '14px',
      },
      fontFamily: {
        brand: ['"Tilt Warp"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'spring-bloom': {
          '0%': { transform: 'scale(0.72)', opacity: '0' },
          '70%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'spring-bloom': 'spring-bloom 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-right': 'slide-in-right 350ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-up': 'fade-up 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
