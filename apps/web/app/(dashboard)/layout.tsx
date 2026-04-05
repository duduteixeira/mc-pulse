import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Activity, Link2, AlertTriangle, LayoutDashboard, History, GitCompare } from 'lucide-react';

export const dynamic = 'force-dynamic';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/connections', label: 'Conexões', icon: Link2 },
  { href: '/findings', label: 'Findings', icon: AlertTriangle },
  { href: '/history', label: 'Histórico', icon: History },
  { href: '/compare', label: 'Comparar', icon: GitCompare },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  return (
    <div className="min-h-screen flex bg-gray-50">
      {isDemo && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-center text-xs py-1.5 font-medium">
          Modo demo · dados fictícios · mudanças não persistem entre reloads
        </div>
      )}
      <aside className={`w-64 border-r border-gray-200 bg-white flex flex-col ${isDemo ? 'pt-6' : ''}`}>
        <div className="p-6 border-b border-gray-200">
          <Link href="/overview" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">MC Pulse</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
