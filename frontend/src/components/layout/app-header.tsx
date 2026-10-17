import {
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from 'lucide-react';
import type { ThemeMode } from '@/contexts/theme-context';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

interface AppHeaderProps {
  title: string;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

const themeOptions: {
  value: ThemeMode;
  label: string;
  icon: typeof Monitor;
}[] = [
  { value: 'system', label: 'System theme', icon: Monitor },
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
];

export function AppHeader({
  title,
  collapsed,
  onToggleSidebar,
  onOpenMobile,
}: AppHeaderProps) {
  const { mode, setMode } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-controls="app-sidebar"
          onClick={onOpenMobile}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-controls="app-sidebar"
          onClick={onToggleSidebar}
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen size={19} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={19} aria-hidden="true" />
          )}
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Student Management System
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          aria-label="Color theme"
          className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={mode === value}
              title={label}
              onClick={() => setMode(value)}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                mode === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="hidden max-w-48 truncate text-sm text-muted-foreground md:block">
          {user?.email}
        </div>

        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
