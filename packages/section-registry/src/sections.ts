import { defineSections } from "@feel-your-website/content-core";

/**
 * The section catalog: every section the CMS may compose a route from, with
 * the schema of its content (so the editor renders a real form, not a JSON
 * textarea) and its slots (so sections nest).
 *
 * A superset of `apps/cms/src/content/template-keys.ts`'s placeholder
 * catalog — `hero` / `guidance` / `footer` keep their keys and gain field
 * schemas; the atoms (`icon`, `text`, `image`, `button`) and the composite
 * `card` are new, added so slot composition has something to demonstrate.
 * A real project replaces this list alongside the components in
 * `registry.tsx`.
 *
 * Rendering these (and materialising slot defaults) is the route-composition
 * work's job — `renderTemplate` here still drives the shell today.
 */
export const sectionCatalog = defineSections([
  {
    key: "hero",
    description: "Full-width hero banner.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Subtitle", type: "text" },
    ],
    slots: [],
  },
  {
    key: "guidance",
    description: "A heading over a paragraph of copy.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "richtext", required: true },
    ],
    slots: [],
  },
  {
    key: "footer",
    description: "Page footer.",
    fields: [{ name: "text", label: "Text", type: "text" }],
    slots: [],
  },
  {
    key: "icon",
    description: "A single icon.",
    fields: [{ name: "name", label: "Icon name", type: "icon", required: true }],
    slots: [],
  },
  {
    key: "text",
    description: "A block of rich text.",
    fields: [{ name: "value", label: "Text", type: "richtext", required: true }],
    slots: [],
  },
  {
    key: "image",
    description: "An image with alt text.",
    fields: [
      { name: "src", label: "Image URL", type: "image", required: true },
      { name: "alt", label: "Alt text", type: "text" },
    ],
    slots: [],
  },
  {
    key: "button",
    description: "A labelled link.",
    fields: [
      { name: "label", label: "Label", type: "text", required: true },
      { name: "href", label: "Link URL", type: "url", required: true },
    ],
    slots: [],
  },
  {
    key: "card",
    description: "A card with an icon slot and a body slot.",
    fields: [{ name: "heading", label: "Heading", type: "text" }],
    slots: [
      { name: "icon", label: "Icon", accepts: ["icon"], arity: "single" },
      { name: "body", label: "Body", accepts: ["text", "button"], arity: "list" },
    ],
  },
]);
