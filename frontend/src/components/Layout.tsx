import { ReactNode } from 'react';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
