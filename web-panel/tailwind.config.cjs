/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* ── shadcn/ui compatible semantic colors ── */
      colors: {
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        action: {
          DEFAULT:    'hsl(var(--action))',
          foreground: 'hsl(var(--action-foreground))',
        },
        danger: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        /* ── Top-level aliases for class usage (e.g. text-emerald-brand) ── */
        'emerald-brand': 'var(--brand-primary)',
        'emerald-glow':  'var(--brand-emerald)',

        /* ── SFCOS raw brand palette ── */
        emerald: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          brand: 'var(--brand-primary)',
          glow:  'var(--brand-emerald)',
        },
        surface: {
          base:    'var(--surface-base)',
          raised:  'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
        },
        graphite: {
          900: 'var(--surface-base)',
          800: 'var(--surface-raised)',
          700: 'var(--surface-overlay)',
          600: '#c9d7ce',
          500: '#93a69a',
          400: '#6d8377',
          300: '#50665a',
        },
      },

      /* ── Typography ── */
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      /* ── Border radius ── */
      borderRadius: {
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      /* ── Box shadow ── */
      boxShadow: {
        'card':          'var(--shadow-card)',
        'card-hover':    'var(--shadow-card-hover)',
        'emerald':       'var(--shadow-emerald)',
        'emerald-sm':    'var(--shadow-emerald-sm)',
        'emerald-ring':  'var(--shadow-glow)',
        'glow':          'var(--shadow-glow)',
      },

      /* ── Backdrop blur ── */
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        DEFAULT: '16px',
        md: '20px',
        lg: '28px',
      },

      /* ── Animations ── */
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-scale': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 6px rgba(26,157,108,0.30)' },
          '50%':       { boxShadow: '0 0 18px rgba(26,157,108,0.55), 0 0 32px rgba(26,157,108,0.20)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        'ring-expand': {
          from: { boxShadow: '0 0 0 0 rgba(26,157,108,0.45)' },
          to:   { boxShadow: '0 0 0 12px rgba(26,157,108,0)' },
        },
      },
      animation: {
        shimmer:         'shimmer 1.6s cubic-bezier(0.45,0,0.55,1) infinite',
        'fade-in':       'fade-in 380ms cubic-bezier(0.16,1,0.3,1) both',
        'fade-in-up':    'fade-in-up 380ms cubic-bezier(0.16,1,0.3,1) both',
        'fade-in-scale': 'fade-in-scale 380ms cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-glow':    'pulse-glow 2.4s ease-in-out infinite',
        float:           'float 3.5s ease-in-out infinite',
        'ring-expand':   'ring-expand 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
      },

      /* ── Transition timing ── */
      transitionTimingFunction: {
        spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        smooth:     'cubic-bezier(0.45, 0, 0.55, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
