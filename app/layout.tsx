import type { Metadata } from 'next';
import { Inter, Archivo } from 'next/font/google';
import './globals.css';
import { site } from '@/content/site';
import { env } from '@/lib/env';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileActionBar } from '@/components/MobileActionBar';
import { Analytics } from '@/components/Analytics';
import { JsonLd } from '@/components/JsonLd';
import { localBusinessJsonLd } from '@/lib/jsonld';

const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['600', '700', '800'] });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'Bedrijfskleding in de Achterhoek | Werkkleding en veiligheid | Frederiks Bedrijfskleding',
    template: '%s | Frederiks Bedrijfskleding',
  },
  description: site.description,
  keywords: [
    'bedrijfskleding Achterhoek', 'werkkleding Achterhoek', 'bedrijfskleding Hengelo Gld',
    'werkkleding bedrukken', 'borduren bedrijfskleding', 'veiligheidsschoenen Achterhoek',
    'werkkleding bouw', 'horecakleding', 'Tricorp', 'Snickers Workwear', 'Mascot',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', locale: 'nl_NL', url: site.url, siteName: site.name,
    title: 'Bedrijfskleding in de Achterhoek | Frederiks Bedrijfskleding',
    description: site.description,
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${archivo.variable}`}>
      <body className="pb-14 lg:pb-0">
        <JsonLd data={localBusinessJsonLd()} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-soft">
          Naar hoofdinhoud
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MobileActionBar />
        <Analytics />
      </body>
    </html>
  );
}
