import { sectionCatalog } from "@feel-your-website/section-registry";

/**
 * This project's section catalog — the sections the CMS may compose a route
 * from, each with its content schema and slots. See `defineSections`' own
 * doc for why this is code, not data.
 *
 * A thin re-export of `@feel-your-website/section-registry`'s catalog today;
 * a real project narrows or replaces it here without touching the panels
 * that import it, exactly as `template-keys.ts` does for the old vocabulary.
 */
export { sectionCatalog };
