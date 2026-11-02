import './globals.css';
import AppShell from '../components/AppShell';

export const metadata = {
  title: { default: 'BERAFLIX — Discover your next story', template: '%s | BERAFLIX' },
  description: 'Discover movies, series, Anime, and live Sports; then build a personal shelf on BERAFLIX by BERA TECH.',
  applicationName: 'BERAFLIX',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'BERAFLIX', statusBarStyle: 'black-translucent' },
  icons: { icon: '/beraflix-mark.svg', apple: '/icon-192.png' }
};

export const viewport = { themeColor: '#08090D', colorScheme: 'dark' };

export default function RootLayout({ children }) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
