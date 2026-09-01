import type { Content, JsonValue } from "@feel-your-website/content-core";

/**
 * Maps a `template_key` (route-bundle items, see `@feel-your-website/config-schema`
 * and `published_route_manifest`) to the component that renders it.
 *
 * This is the piece the README's own notes on `apps/cms` and the Supabase
 * adapters flagged as not built yet: the CMS can author a route bundle and
 * the database serves it correctly, but nothing consumed
 * `getRouteManifest()`/`getContent()` to actually render a page from it.
 * `apps/shell`'s catch-all route (`src/routes/$.tsx`) is that consumer;
 * this registry lives in its own package so `apps/cms` can reuse it to
 * render a preview of the same components.
 *
 * The three keys here match `apps/cms/src/content/template-keys.ts`'s own
 * placeholder catalog exactly, plus `help` (the one real fixture route
 * `content-adapter-memory`'s seed ships, at `/help`) — both sides of this
 * boilerplate's example vocabulary have to agree for local dev to work with
 * no backend at all. A real project replaces both this registry and that
 * catalog together; neither is meant to be the final template set.
 */

type TemplateComponent = (props: {
  fields: Readonly<Record<string, JsonValue>>;
}) => React.JSX.Element;

/** Reads a field as a string, defaulting to "" rather than rendering "undefined". */
function text(fields: Readonly<Record<string, JsonValue>>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

const HeroTemplate: TemplateComponent = ({ fields }) => (
  <section className="border-border flex flex-col gap-2 border-b pb-8">
    <h1 className="text-3xl font-semibold">{text(fields, "title")}</h1>
    {text(fields, "subtitle") && (
      <p className="text-muted-foreground text-lg">{text(fields, "subtitle")}</p>
    )}
  </section>
);

/** Shared by `guidance` and `help` — both are a heading over a paragraph. */
const TitleBodyTemplate: TemplateComponent = ({ fields }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-xl font-medium">{text(fields, "title")}</h2>
    <p className="text-muted-foreground">{text(fields, "body")}</p>
  </section>
);

const FooterTemplate: TemplateComponent = ({ fields }) => (
  <footer className="border-border text-muted-foreground border-t pt-4 text-sm">
    {text(fields, "text")}
  </footer>
);

const TEMPLATE_REGISTRY: Readonly<Record<string, TemplateComponent>> = {
  hero: HeroTemplate,
  guidance: TitleBodyTemplate,
  help: TitleBodyTemplate,
  footer: FooterTemplate,
};

/**
 * Renders one route bundle item.
 *
 * Missing content and an unregistered template key are rendered visibly
 * rather than silently skipped — a CMS author publishing a route with a key
 * this build doesn't know about (or content that hasn't been filled in yet)
 * is a mistake worth seeing on the page, not one that quietly produces a
 * shorter page than intended.
 */
export function renderTemplate(templateKey: string, content: Content | null): React.JSX.Element {
  const Component = TEMPLATE_REGISTRY[templateKey];

  if (!Component) {
    return (
      <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed p-4 text-sm">
        No template registered for “{templateKey}”.
      </div>
    );
  }

  if (!content) {
    return (
      <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed p-4 text-sm">
        “{templateKey}” has no content yet.
      </div>
    );
  }

  return <Component fields={content.fields} />;
}
