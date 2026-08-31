import { ThemeProvider } from "@puranderdua8/theme/client";
import { createFileRoute } from "@tanstack/react-router";

import { ThemeShowcase } from "@/components/theme-showcase";

export const Route = createFileRoute("/")({
  component: Home,
});

const THEMES = ["base", "corporate", "playful"] as const;

/**
 * Phase 1 proving page. `ThemeShowcase` is one definition; the only thing that
 * differs between the columns is the `theme` prop on the provider.
 */
function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">feel-your-website</h1>
        <p className="text-muted-foreground text-sm">
          Phase 1 — theming contract. The columns below share one component definition.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {THEMES.map((theme) => (
          <section key={theme} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground font-mono text-xs uppercase">{theme}</h2>
            <ThemeProvider theme={theme}>
              <ThemeShowcase />
            </ThemeProvider>
          </section>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {THEMES.map((theme) => (
          <section key={theme} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground font-mono text-xs uppercase">{theme} · dark</h2>
            <ThemeProvider theme={theme} mode="dark">
              <ThemeShowcase />
            </ThemeProvider>
          </section>
        ))}
      </div>
    </main>
  );
}
