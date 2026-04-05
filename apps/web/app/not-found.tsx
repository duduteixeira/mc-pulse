import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-blue-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Página não encontrada</h1>
        <p className="mt-2 text-gray-600">
          O recurso que você procurou não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
