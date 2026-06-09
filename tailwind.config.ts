import type { Config } from 'tailwindcss';

/**
 * Huisstijl Frederiks Bedrijfskleding — afgeleid van het logo.
 *   - Houtskool / antraciet  (wordmark "FREDERIKS", emblemen, footer, tekst)
 *   - Oranje                 (accent uit het logo: knoppen, links, CTA's)
 *   - Neutrale grijzen       (vlakken, lijnen, achtergronden)
 * Geen blauw — de huisstijl is charcoal + oranje.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f6f6', 100: '#e7e7e7', 200: '#cfcfcf', 300: '#adadad',
          400: '#828282', 500: '#5f5f5f', 600: '#474747', 700: '#363636',
          800: '#272727', 900: '#1c1c1c', DEFAULT: '#272727',
        },
        amber: {
          50: '#fef3ec', 100: '#fbdcc7', 200: '#f8bd97', 300: '#f49a64',
          400: '#f07d3c', 500: '#ec6726', 600: '#d4541a', 700: '#b04318',
          800: '#8c361a', 900: '#722f19', DEFAULT: '#ec6726',
        },
        gold: { star: '#f5a623' },
        warm: '#52504e',
        mist: '#f6f5f4',
        line: '#e4e2e0',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(28,28,28,0.08), 0 8px 30px -10px rgba(28,28,28,0.12)',
        card: '0 1px 3px rgba(28,28,28,0.06), 0 12px 36px -16px rgba(39,39,39,0.18)',
      },
      maxWidth: { prose: '68ch' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-up': 'fade-up 0.5s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
