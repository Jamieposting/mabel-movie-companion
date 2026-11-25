import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mabel Movie Companion',
  description: 'Share spoiler-safe subtitle context with your existing conversation.',
  openGraph: {
    title: 'Mabel Movie Companion',
    description: 'Watch something together.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Mabel Movie Companion',
    description: 'Watch something together.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
