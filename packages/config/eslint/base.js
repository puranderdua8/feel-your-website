import js from "@eslint/js";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * Shared base ESLint flat config: JS/TS recommended rules + turbo's
 * env-var-usage rule. Consumers spread this into their own eslint.config.js.
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/storybook-static/**",
      "**/coverage/**",
      "**/node_modules/**",
      // Vite/Vitest transpile a `*.config.ts` into a short-lived
      // `*.timestamp-<epoch>-<hash>.mjs` bundle (created, executed, deleted)
      // whenever a TS config file loads. If `lint` and `test` run in
      // parallel (as Turbo does for these, by design — no ordering between
      // them), ESLint's directory glob can catch that file mid-existence
      // and then hit ENOENT trying to actually read it once Vitest has
      // already cleaned it up. Excluding the pattern outright removes the
      // race rather than trying to serialize the two tasks.
      "**/*.timestamp-*.mjs",
      // tsup does the same thing with a different name: loading
      // `tsup.config.ts` writes `tsup.config.bundled_<hash>.mjs`, executes
      // it, and deletes it. Same race, same fix. This only started failing
      // once several packages built with tsup at once — with a warm Turbo
      // cache the build is skipped entirely and the window never opens,
      // which is why it appeared in CI and not locally.
      "**/*.bundled_*.mjs",
    ],
  },
];

export default baseConfig;
