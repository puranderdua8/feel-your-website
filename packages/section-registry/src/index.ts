// The section/template registry, shared by the shell (which renders published
// route bundles) and the CMS (which will render an in-process preview of the
// same components). Kept vendor-neutral: it depends only on
// `@feel-your-website/content-core`'s content model, never on an adapter.

export * from "./registry.js";
