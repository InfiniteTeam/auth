import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Infinite Studio SSO',
  description: 'Infinite Studio 서비스 통합 인증',
  icons: { icon: '/favicon.svg' },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
