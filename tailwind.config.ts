import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#ffffff',
        surface: '#f5f5f5',
        border: '#e5e5e5',
        divider: '#f0f0f0',
        hover: '#fafafa',
        ink: {
          DEFAULT: '#1a1a1a',
          secondary: '#888888',
          hint: '#bbbbbb',
          body: '#444444',
        },
        accent: '#673e21',
        success: { bg: '#e8f5e9', fg: '#2e7d32' },
        warning: { bg: '#fff3e0', fg: '#e65100' },
        danger: { bg: '#ffebee', fg: '#c62828' },
      },
      fontSize: {
        // Tibi typography scale (px in [], rem here at 16px base)
        label: ['10px', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '500' }],
        body: ['13px', { lineHeight: '1.65', fontWeight: '400' }],
        btn: ['12px', { lineHeight: '1.2', fontWeight: '500' }],
        section: ['17px', { lineHeight: '1.3', fontWeight: '500' }],
        page: ['26px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        stat: ['28px', { lineHeight: '1.1', fontWeight: '500' }],
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        pill: '100px',
      },
      borderWidth: {
        hairline: '0.5px',
      },
      spacing: {
        card: '20px',
      },
      boxShadow: {
        none: 'none',
      },
    },
  },
  plugins: [],
};

export default config;
