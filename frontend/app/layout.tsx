import './globals.css';
import { BackgroundVideo, SakuraOverlay } from '../components/BackgroundVideo';

export const metadata = {
  title: 'Kizuna Gateway - Japan-India Market Entry',
  description: 'Demo-safe market-entry decision-support MVP for Japanese SMEs evaluating expansion into India.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased selection:bg-aijiro selection:text-white">
        <BackgroundVideo />
        <SakuraOverlay count={24} />
        <main className="relative z-10 mx-auto max-w-7xl p-4 md:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
