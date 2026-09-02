import { reactConfig } from "@feel-your-website/config/eslint/react";

export default [
  ...reactConfig,
  {
    // Build scripts and the container entrypoint run in Node, not the
    // browser: they legitimately use console, process and friends. PORT/HOST
    // are runtime knobs for `server.js`, not build inputs Turbo should track.
    files: ["scripts/**/*.mjs", "server.js"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
  {
    ignores: [".output/**", ".netlify/**", "dist/**", "src/routeTree.gen.ts"],
  },
];
