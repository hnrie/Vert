import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VERT - Phim không giới hạn',
  description: 'VERT: Phim không giới hạn',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-32.png',
    apple: '/icons/icon-192.png'
  },
  appleWebApp: {
    capable: true,
    title: 'Vert',
    statusBarStyle: 'black-translucent'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#141414',
};

export default function rootlayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div id="loader-screen" className="loader-overlay" aria-hidden="true">
          <div className="loader-inner">
            <div className="loader-logo">
              <span>V</span>ERT
            </div>
            <div className="loader-bar">
              <div className="loader-bar-fill"></div>
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
