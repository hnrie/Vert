import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const interfont = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VERT - Phim không giới hạn',
  description: 'VERT: Phim không giới hạn',
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
      <body className={interfont.className}>
        <div id="loader-screen" className="loader-overlay hidden">
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
