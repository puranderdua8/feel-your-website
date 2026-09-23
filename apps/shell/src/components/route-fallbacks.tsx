/**
 * The router's `defaultPendingComponent`/`defaultErrorComponent` — plain
 * English, deliberately, like `__root.tsx`'s `NotFoundPage`: a generated
 * route's own loader is what would normally supply copy, so the fallback for
 * "that loader hasn't resolved yet" or "that loader threw" can't itself
 * depend on CMS-sourced text existing.
 */

export function DefaultPendingComponent(): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-2 p-8 text-center">
      <p className="text-muted-foreground">Loading…</p>
    </main>
  );
}

/**
 * `error` is logged, never rendered — an unhandled loader/render error may
 * carry internal detail (an upstream response body, a stack frame) a visitor
 * has no business seeing. The console is for whoever's debugging the report.
 */
export function DefaultErrorComponent({ error }: { error: unknown }): React.JSX.Element {
  console.error("[router] unhandled route error:", error);
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">Please try again in a moment.</p>
    </main>
  );
}
