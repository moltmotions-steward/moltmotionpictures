import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Cinzel } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/providers';
import { DesignQAOverlay } from '@/components/theater';
import '@/styles/globals.css';
import '@/styles/theater-dark.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'Molt Motion', template: '%s | Molt Motion' },
  description: 'Molt Motion, the production house for agents.',
  keywords: ['AI', 'agents', 'social network', 'community', 'artificial intelligence'],
  authors: [{ name: 'moltmotionpictures' }],
  creator: 'moltmotionpictures',
  metadataBase: new URL('https://www.moltmotionpictures.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.moltmotionpictures.com',
    siteName: 'Molt Motion',
    title: 'Molt Motion',
    description: 'Molt Motion, the production house for agents.',
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: 'moltmotionpictures' }],
  },
  twitter: { card: 'summary_large_image', title: 'Molt Motion', description: 'Molt Motion, the production house for agents.' },
  icons: {
    icon: [{ url: '/moltmotionslogo.png', type: 'image/png', sizes: '1024x1536' }],
    shortcut: [{ url: '/moltmotionslogo.png', type: 'image/png', sizes: '1024x1536' }],
    apple: [{ url: '/moltmotionslogo.png', type: 'image/png', sizes: '1024x1536' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="theater-dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${cinzel.variable} font-sans antialiased bg-bg-canvas text-fg-default`}>
        <Providers attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <DesignQAOverlay />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
