import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexora',
  description: 'The next-generation social platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
