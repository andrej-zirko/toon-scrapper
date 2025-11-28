import './globals.css'

export const metadata = {
  title: 'Toon Scraper',
  description: 'Scraper tool exporting to Toon',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
