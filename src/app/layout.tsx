// src/app/layout.tsx
import type { Metadata } from 'next';
import PlausibleProvider from 'next-plausible';
import { Inter } from 'next/font/google';
import './globals.css';
import { PrivyClientProvider } from '@/components/PrivyProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OneBalance + Privy Demo',
  description: 'Seamless chain-abstracted transfers with OneBalance and Privy',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PlausibleProvider domain="onebalance-privy-demo.vercel.app">
      <html lang="en">
        <body className={inter.className}>
          <PrivyClientProvider>
            {children}
          </PrivyClientProvider>
        </body>
      </html>
    </PlausibleProvider>
  );
}