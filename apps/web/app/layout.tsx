import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MC Pulse',
  description: 'Health check SaaS para Salesforce Marketing Cloud',
};

/**
 * Força renderização dinâmica em todas as rotas.
 * Necessário porque o ClerkProvider precisa ler env vars em runtime,
 * e o Next tenta pré-renderizar páginas como /_not-found estaticamente
 * por default (o que causa erro de publishableKey missing no build).
 */
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/overview"
      signUpFallbackRedirectUrl="/overview"
    >
      <html lang="pt-BR">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

