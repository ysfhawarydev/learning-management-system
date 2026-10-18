import {
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

export type PageId =
  | 'Overview'
  | 'Students'
  | 'Departments'
  | 'Courses'
  | 'Course Offerings'
  | 'Semesters'
  | 'Attendance'
  | 'Settings';

interface AppSidebarProps {
  activePage: PageId;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (page: PageId) => void;
  onCloseMobile: () => void;
}

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Students', icon: GraduationCap },
  { label: 'Departments', icon: Building2 },
  { label: 'Courses', icon: BookOpen },
  { label: 'Course Offerings', icon: BookOpenCheck },
  { label: 'Semesters', icon: CalendarRange },
  { label: 'Attendance', icon: CalendarDays },
] as const;

export function AppSidebar({
  activePage,
  collapsed,
  mobileOpen,
  onNavigate,
  onCloseMobile,
}: AppSidebarProps) {
  const navigate = (page: PageId) => {
    onNavigate(page);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={[
          'flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width,transform] duration-200',
          'fixed inset-y-0 left-0 z-50 w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:sticky md:top-0 md:z-auto md:translate-x-0',
          collapsed ? 'md:w-20' : 'md:w-64',
        ].join(' ')}
      >
        <div
          className={[
            'flex h-16 shrink-0 items-center gap-3 border-b border-border',
            collapsed ? 'md:justify-center md:px-2' : 'px-5',
            'px-5',
          ].join(' ')}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </div>

          <div className={collapsed ? 'md:hidden' : 'min-w-0'}>
            <p className="truncate text-sm font-semibold tracking-tight">
              EduManage
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Academic management
            </p>
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto p-3"
        >
          <p
            className={[
              'px-3 pb-2 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground',
              collapsed ? 'md:hidden' : '',
            ].join(' ')}
          >
            Workspace
          </p>

          {navigation.map(({ label, icon: Icon }) => {
            const isActive = activePage === label;

            return (
              <button
                key={label}
                type="button"
                title={collapsed ? label : undefined}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(label)}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed ? 'md:justify-center md:px-2' : '',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            title={collapsed ? 'Settings' : undefined}
            aria-current={activePage === 'Settings' ? 'page' : undefined}
            onClick={() => navigate('Settings')}
            className={[
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed ? 'md:justify-center md:px-2' : '',
              activePage === 'Settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            <Settings className="size-[18px] shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'md:hidden' : ''}>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}
