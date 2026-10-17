import { useState, type ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar, type PageId } from '@/components/layout/app-sidebar';

interface AppLayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

export function AppLayout({
  activePage,
  onNavigate,
  children,
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar
        activePage={activePage}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={onNavigate}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="min-w-0 flex-1">
        <AppHeader
          title={activePage}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((current) => !current)}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
