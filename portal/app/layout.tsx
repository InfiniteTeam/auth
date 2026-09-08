import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Infiniteteam Identity Portal',
  description: 'Infiniteteam Identity Portal',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}