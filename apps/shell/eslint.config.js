import { reactConfig } from "@feel-your-website/config/eslint/react";

export default [
  ...reactConfig,
  {
    // Build scripts run in Node, not the browser: they legitimately use
    // console, process and friends.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    ignores: [".output/**", ".netlify/**", "dist/**", "src/routeTree.gen.ts"],
  },
];
