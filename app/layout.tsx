import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SanoCheck - Smart Sanitation Verification',
  description: 'Hybrid sanitation verification and dispatch system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
