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
 * `renderComposition` in `compose.tsx` renders a route's tree of these and
 * materialises any unfilled slot defaults.
 */
/**
 * A self-contained placeholder image, so the `image` section's sample renders
 * offline and under a strict CSP — no external host.
 */
const SAMPLE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='240'%3E%3Crect width='480' height='240' fill='%23d1d5db'/%3E%3C/svg%3E";

export const sectionCatalog = defineSections([
  {
    key: "hero",
    description: "Full-width hero banner.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Subtitle", type: "text" },
    ],
    slots: [],
    sample: {
      fields: {
        title: "Feel your website",
        subtitle: "The headline sits here, with a supporting line beneath it.",
      },
    },
  },
  {
    key: "guidance",
    description: "A heading over a paragraph of copy.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "richtext", required: true },
    ],
    slots: [],
    sample: {
      fields: {
        title: "How it works",
        body: "A paragraph of guidance copy. On a real route this text comes from the route, not from the section.",
      },
    },
  },
  {
    key: "footer",
    description: "Page footer.",
    fields: [{ name: "text", label: "Text", type: "text" }],
    slots: [],
    sample: { fields: { text: "© 2026 feel-your-website — sample footer text." } },
  },
  {
    key: "icon",
    description: "A single icon.",
    fields: [{ name: "name", label: "Icon name", type: "icon", required: true }],
    slots: [],
    sample: { fields: { name: "sparkles" } },
  },
  {
    key: "text",
    description: "A block of rich text.",
    fields: [{ name: "value", label: "Text", type: "richtext", required: true }],
    slots: [],
    sample: {
      fields: { value: "A block of body copy that a route replaces with its own words." },
    },
  },
  {
    key: "image",
    description: "An image with alt text.",
    fields: [
      { name: "src", label: "Image URL", type: "image", required: true },
      { name: "alt", label: "Alt text", type: "text" },
    ],
    slots: [],
    sample: { fields: { src: SAMPLE_IMAGE, alt: "Sample image" } },
  },
  {
    key: "button",
    description: "A labelled link.",
    fields: [
      { name: "label", label: "Label", type: "text", required: true },
      { name: "href", label: "Link URL", type: "url", required: true },
    ],
    slots: [],
    sample: { fields: { label: "Get started", href: "#" } },
  },
  {
    key: "card",
    description: "A card with an icon slot and a body slot.",
    fields: [{ name: "heading", label: "Heading", type: "text" }],
    slots: [
      { name: "icon", label: "Icon", accepts: ["icon"], arity: "single" },
      { name: "body", label: "Body", accepts: ["text", "button"], arity: "list" },
    ],
    sample: {
      fields: { heading: "Card heading" },
      slots: {
        icon: [{ sectionKey: "icon", fields: { name: "sparkles" } }],
        body: [
          { sectionKey: "text", fields: { value: "Body text inside the card." } },
          { sectionKey: "button", fields: { label: "Learn more", href: "#" } },
        ],
      },
    },
  },
]);
