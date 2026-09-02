import { reactConfig } from "@feel-your-website/config/eslint/react";

export default [
  ...reactConfig,
  {
    // The container entrypoint runs in Node, not the browser: console,
    // process and URL are legit, and PORT/HOST are runtime knobs, not build
    // inputs Turbo should track.
    files: ["server.js"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
  {
    ignores: [".output/**", ".netlify/**", "dist/**", "src/routeTree.gen.ts"],
  },
];
