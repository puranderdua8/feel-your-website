/**
 * Every environment variable `apps/shell` reads at runtime.
 *
 * `env-manifest.test.ts` checks that `turbo.json`'s `globalEnv` covers all of
 * them — so a build made with a different value is never served from cache —
 * and that `.env.example` documents each. Add a var here the moment shell
 * code starts reading it, and the tests will point at whatever else needs
 * updating.
 */
export const SHELL_ENV_MANIFEST = [
  "CONTENT_ADAPTER",
  "AUTH_PROVIDER",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ACTION_INVOKER",
  "ACTION_CONFIG",
  "ACTION_HOST_ALLOWLIST",
  "ACTION_FIRST_PARTY_HOSTS",
  "ACTION_CACHE",
  "ANALYTICS_PROVIDER",
  "ANALYTICS_GA_MEASUREMENT_ID",
  "ANALYTICS_COLLECTOR_PATH",
  "ANALYTICS_SAMPLE_RATE",
] as const;
