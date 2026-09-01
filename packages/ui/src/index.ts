// Barrel for the vendored component library.
//
// These components used to be distributed through a shadcn registry from a
// separate repo. They live here now: this boilerplate is cloned per project,
// so a published, permissioned package bought nothing and cost a registry
// credential in CI, on Netlify, and in every clone. If a client ever needs
// one design system across several repos, extracting this package back out
// is the change to make then.
//
// Layout follows shadcn's own convention: one flat file per component under
// `components/ui/`, a `components.json` at the package root, and `cn` in
// `lib/utils`. This barrel is hand-maintained — `src/barrel.test.ts` fails
// if a `components/ui/*` file is added without a matching re-export here.

export { cn } from "./lib/utils.js";

export * from "./components/ui/badge.js";
export * from "./components/ui/button.js";
export * from "./components/ui/card.js";
export * from "./components/ui/dialog.js";
export * from "./components/ui/dropdown-menu.js";
export * from "./components/ui/input.js";
export * from "./components/ui/label.js";
export * from "./components/ui/select.js";
export * from "./components/ui/tabs.js";
export * from "./components/ui/tooltip.js";
