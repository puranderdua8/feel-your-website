import { defineTemplateKeys } from "@feel-your-website/content-core";

/**
 * The template vocabulary this project's route bundle editor may compose
 * from — see `defineTemplateKeys`'s own doc for why this is code, not data.
 *
 * This boilerplate ships no real templates or a renderer for them (`apps/shell`
 * wires `loadContent` in its BFF, but no route calls it yet — see that app's
 * own notes). These two are a placeholder standing in for whatever a real
 * project's UI kit actually exports, so the route bundle editor has a real,
 * closed vocabulary to validate against rather than accepting anything typed
 * into it. A real project replaces this list; it does not need to touch
 * anything that imports it.
 */
export const templateCatalog = defineTemplateKeys([
  { name: "hero", description: "Full-width hero banner." },
  { name: "guidance", description: "Guidance copy block." },
  { name: "footer", description: "Page footer." },
]);
