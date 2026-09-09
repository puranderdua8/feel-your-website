---
"@feel-your-website/shell": patch
---

Add the shell's registered-actions configuration, ahead of wiring it at the DI
seam:

- `src/server/config/action.ts` — `loadActionConfig(env)` reads `ACTION_INVOKER`
  (`none` | `memory` | `http`), `ACTION_CACHE` (`memory` | `blobs`), and, for
  `http`, the `ACTION_CONFIG` JSON blob plus `ACTION_HOST_ALLOWLIST` /
  `ACTION_FIRST_PARTY_HOSTS`. A malformed value fails at first read, naming the
  variable. It stays free of the concrete invoker package — `adapters.ts` turns
  `rawBindings` into `HttpActionBindings`.
- `src/server/config/env-manifest.ts` — `SHELL_ENV_MANIFEST`, the list of every
  env var shell reads. `env-manifest.test.ts` fails if `turbo.json`'s
  `globalEnv` or `.env.example` misses one.
- `turbo.json` `globalEnv` and `.env.example` gain the `ACTION_*` variables.

Nothing calls `loadActionConfig` yet.
