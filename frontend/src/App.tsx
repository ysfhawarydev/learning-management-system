import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';

const themeOptions: {
  value: ThemeMode;
  label: string;
  icon: typeof Monitor;
}[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function App() {
  const { mode, setMode } = useTheme();

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors">
      <header className="flex h-16 items-center justify-between border-b px-6 lg:px-10">
        <a href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-sm font-bold">SM</span>
          </span>
          <span>Student Management</span>
        </a>

        <div
          aria-label="Color theme"
          className="flex items-center gap-1 rounded-xl border bg-card p-1"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={mode === value}
              aria-label={`${label} theme`}
              onClick={() => setMode(value)}
            >
              <Icon aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-6 py-20">
        <span className="mb-5 w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Frontend foundation
        </span>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Student management,
          <span className="block text-primary">built for clarity.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          A clean foundation for managing students, organizing records, and
          building a reliable academic administration workflow.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" size="lg">
            Get started
          </Button>
          <Button type="button" variant="outline" size="lg">
            Explore dashboard
          </Button>
        </div>
      </section>
    </main>
  );
}

export default App;
