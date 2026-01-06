import { useState, ReactNode, useEffect } from 'react';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function Layout({ sidebar, children }: LayoutProps) {
  // Load sidebar state from localStorage, default to false (expanded)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-collapse sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isMobile]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 relative">
      {/* Mobile overlay backdrop */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col h-full bg-slate-800 border-r border-slate-700
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed
            ? isMobile
              ? 'fixed inset-y-0 left-0 z-50 -translate-x-full'
              : 'w-0 min-w-0 overflow-hidden border-r-0'
            : 'w-80'
          }
          ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
        `}
      >
        <div className="flex flex-col h-full w-full overflow-hidden">
          {sidebar}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative">
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className={`
            fixed top-4 z-30
            ${sidebarCollapsed ? 'left-4' : 'left-84'}
            p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md
            text-slate-300 hover:text-slate-100 transition-all duration-300
            shadow-lg
          `}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {sidebarCollapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            )}
          </svg>
        </button>

        {/* Content Container - uses full available width */}
        <div className="min-h-full">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
