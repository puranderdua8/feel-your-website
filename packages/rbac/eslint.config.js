import { reactConfig } from "@feel-your-website/config/eslint/react";

export default [
  ...reactConfig,
  {
    // Build scripts run in Node, not the browser: they legitimately use
    // console, URL and friends.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", URL: "readonly" },
    },
  },
  { ignores: ["dist/**"] },
];
