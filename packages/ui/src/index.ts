// Barrel for the vendored component library.
//
// These components used to be distributed through a shadcn registry from a
// separate repo. They live here now: this boilerplate is cloned per project,
// so a published, permissioned package bought nothing and cost a registry
// credential in CI, on Netlify, and in every clone. If a client ever needs
// one design system across several repos, extracting this package back out
// is the change to make then.

export { cn } from "./lib/utils.js";

export * from "./components/badge/badge.js";
export * from "./components/button/button.js";
export * from "./components/card/card.js";
export * from "./components/dialog/dialog.js";
export * from "./components/dropdown-menu/dropdown-menu.js";
export * from "./components/input/input.js";
export * from "./components/label/label.js";
export * from "./components/select/select.js";
export * from "./components/tabs/tabs.js";
export * from "./components/tooltip/tooltip.js";
