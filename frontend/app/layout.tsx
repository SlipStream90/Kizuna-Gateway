import './globals.css';
import { LanguageProvider } from '../lib/i18n';

export const metadata = {
  title: 'Nishi Link — Japan → India Market Entry',
  description: 'Decision support for Japanese SMEs evaluating expansion into India: regions, partners, compliance and go-to-market cost, with sources in plain view.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Self-hosted so the demo never waits on an external CDN (see public/fonts/README.md). */}
        <link rel="stylesheet" href="/fonts/noto.css" />
      </head>
      <body className="min-h-screen antialiased selection:bg-akaneiro selection:text-white">
        <main className="relative">
          <LanguageProvider>{children}</LanguageProvider>
        </main>
      </body>
    </html>
  );
}
