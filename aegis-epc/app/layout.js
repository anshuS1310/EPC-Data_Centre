import { Inter } from 'next/font/google';
import './globals.css';
import { SharedBrainProvider } from './context/SharedBrainContext';
import DynamicBackground from './components/DynamicBackground';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata = {
  title: 'DCIMS — Data Centre Infrastructure Management',
  description: 'Project intelligence platform for data centre EPC delivery — quality, schedule, supply chain and commissioning in one unified system.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-slate-200 text-slate-900">
        {/* Fixed animated network topology background — behind all UI */}
        <DynamicBackground />

        {/* App content — sits above canvas via z-index on layout wrapper */}
        <SharedBrainProvider>
          {children}
        </SharedBrainProvider>
      </body>
    </html>
  );
}
