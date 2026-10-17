import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';

export type PageId =
  'Overview' | 'Students' | 'Courses' | 'Attendance' | 'Settings';

interface AppSidebarProps {
  activePage: PageId;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (page: PageId) => void;
  onCloseMobile: () => void;
}

const navigation: {
  label: PageId;
  icon: typeof LayoutDashboard;
}[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Students', icon: Users },
  { label: 'Courses', icon: BookOpen },
  { label: 'Attendance', icon: CalendarCheck },
];

export function AppSidebar({
  activePage,
  collapsed,
  mobileOpen,
  onNavigate,
  onCloseMobile,
}: AppSidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          collapsed ? 'lg:w-[84px]' : 'lg:w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap size={21} aria-hidden="true" />
          </div>

          <div className={collapsed ? 'lg:hidden' : ''}>
            <p className="text-sm font-semibold tracking-tight">Campus</p>
            <p className="text-xs text-muted-foreground">Student Management</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p
            className={`mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
              collapsed ? 'lg:hidden' : ''
            }`}
          >
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map(({ label, icon: Icon }) => {
              const active = activePage === label;

              return (
                <button
                  key={label}
                  type="button"
                  title={collapsed ? label : undefined}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onNavigate(label);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon size={19} className="shrink-0" aria-hidden="true" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                  {active && (
                    <span
                      className={`ml-auto size-1.5 rounded-full bg-primary ${
                        collapsed ? 'lg:hidden' : ''
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <p
            className={`mb-3 mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
              collapsed ? 'lg:hidden' : ''
            }`}
          >
            Preferences
          </p>

          <button
            type="button"
            title={collapsed ? 'Settings' : undefined}
            aria-current={activePage === 'Settings' ? 'page' : undefined}
            onClick={() => {
              onNavigate('Settings');
              onCloseMobile();
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activePage === 'Settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Settings size={19} className="shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'lg:hidden' : ''}>Settings</span>
          </button>
        </div>

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
              A
            </div>
            <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-medium">Administrator</p>
              <p className="truncate text-xs text-muted-foreground">
                Management portal
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
