import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geist = localFont({
  src: './fonts/Geist-Latin.woff2',
  variable: '--font-geist',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMono-Latin.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
})
const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Latin.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
})

export const metadata: Metadata = {
  title: 'ORBIT AI — Smart Inventory Operations for Petrosains',
  description:
    'Scan, track and manage inventory with speed and clarity. An offline-first AI inventory operations app.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b1020',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-background ${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
