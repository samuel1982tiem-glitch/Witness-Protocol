import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppFrame } from '@/components/app-frame'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Witness Protocol',
  description:
    'A private, local-first, encrypted evidence documentation tool. Works offline. No cloud, no tracking.',
  generator: 'v0.app',
  applicationName: 'Witness Protocol',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Witness Protocol',
  },
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <AppFrame>{children}</AppFrame>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
