import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home(): Promise<JSX.Element> {
  const user = await currentUser();
  if (user) redirect('/overview');

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
          <span className="h-2 w-2 rounded-full bg-blue-500 scan-pulse" />
          Health check para Salesforce Marketing Cloud
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-4">
          MC Pulse
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Conecte seu Marketing Cloud e receba um diagnóstico completo de saúde — score,
          riscos e plano de ação — em minutos.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Começar grátis
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
