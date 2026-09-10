import type { JsonValue } from "@feel-your-website/content-core";

import type { RouteRenderContext } from "./context.js";
import { classifyHref, type LinkSpec, type RenderLink } from "./link.js";

/** A section's rendered content: a plain field bag, or `null` when unfilled. */
export type SectionFields = Readonly<Record<string, JsonValue>> | null;

/**
 * What a section that pulls external data receives for its instance: the
 * already-parsed payload, or a normalised failure. The BFF aggregates these
 * (see the query registry); a section renders a fallback for a failure or an
 * absent entry.
 */
export type SectionDataEntry =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: { readonly code: string } };

/**
 * Maps a section key to the React component that renders it — the one
 * registry the shell (rendering published routes) and the CMS (previewing
 * them) both use.
 *
 * The keys here match `apps/cms/src/content/sections.ts`'s catalog: `hero` /
 * `guidance` / `footer` plus the atoms (`icon`, `text`, `image`, `button`)
 * and the composite `card`, and `help` (the one real fixture route
 * `content-adapter-memory` ships, at `/help`). A real project replaces this
 * registry alongside that catalog.
 *
 * Every component takes the same `{ fields, slots }` shape. Leaf sections
 * ignore `slots`; a composite like `card` reads `slots.icon` / `slots.body`,
 * which `renderComposition` has already rendered from the route's tree.
 */

export interface SectionComponentProps {
  fields: Readonly<Record<string, JsonValue>>;
  /** Rendered slot children, keyed by `SectionSlotSpec.name`. `{}` for a leaf. */
  slots: Readonly<Record<string, React.ReactNode>>;
  /**
   * The route this section is rendered on — params, pathname, breadcrumb chain.
   * Absent when there is no route context (the CMS section gallery). Optional so
   * the leaf sections below, which only read `fields`/`slots`, are unaffected.
   *
   * `route.params` are raw URL segments: untrusted input. Escape any value
   * before putting it in markup, a URL, or a query.
   */
  route?: RouteRenderContext;
  /**
   * Host-injected CTA link renderer (see {@link RenderLink}). Absent in the
   * CMS gallery and until the shell wires it — `ButtonSection` then falls back
   * to a plain `<a>`.
   */
  renderLink?: RenderLink;
  /**
   * External data for this section instance, aggregated by the BFF. Absent
   * for a section that declares no data need, in the CMS preview, or while a
   * non-blocking fetch is still in flight — the section renders a fallback in
   * those cases and for `{ ok: false }`.
   */
  data?: SectionDataEntry;
}

export type SectionComponent = (props: SectionComponentProps) => React.JSX.Element;

/** Reads a field as a string, defaulting to "" rather than rendering "undefined". */
function text(fields: Readonly<Record<string, JsonValue>>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

const HeroSection: SectionComponent = ({ fields }) => (
  <section className="border-border flex flex-col gap-2 border-b pb-8">
    <h1 className="text-3xl font-semibold">{text(fields, "title")}</h1>
    {text(fields, "subtitle") && (
      <p className="text-muted-foreground text-lg">{text(fields, "subtitle")}</p>
    )}
  </section>
);

/** Shared by `guidance` and `help` — both are a heading over a paragraph. */
const TitleBodySection: SectionComponent = ({ fields }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-xl font-medium">{text(fields, "title")}</h2>
    <p className="text-muted-foreground">{text(fields, "body")}</p>
  </section>
);

const FooterSection: SectionComponent = ({ fields }) => (
  <footer className="border-border text-muted-foreground border-t pt-4 text-sm">
    {text(fields, "text")}
  </footer>
);

const IconSection: SectionComponent = ({ fields }) => (
  <span className="text-muted-foreground text-sm" data-icon={text(fields, "name")}>
    {text(fields, "name")}
  </span>
);

const TextSection: SectionComponent = ({ fields }) => (
  <p className="text-muted-foreground">{text(fields, "value")}</p>
);

const ImageSection: SectionComponent = ({ fields }) =>
  text(fields, "src") ? (
    <img
      src={text(fields, "src")}
      alt={text(fields, "alt")}
      className="max-w-full rounded-[var(--radius)]"
    />
  ) : (
    <span className="text-muted-foreground text-sm">(no image)</span>
  );

const CTA_CLASS =
  "bg-primary text-primary-foreground inline-flex w-fit items-center rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium";

/** A CTA that can't render as a link (unsafe href, or `action` mode before it is wired). */
function DisabledCta({ label }: { label: string }): React.JSX.Element {
  return (
    <span className={`${CTA_CLASS} cursor-not-allowed opacity-50`} aria-disabled="true">
      {label}
    </span>
  );
}

/**
 * A call-to-action. `mode: "link"` (the default) renders an internal or
 * external link; `mode: "action"` is wired later and renders a disabled
 * placeholder until then. An unsafe href renders the placeholder too.
 */
const ButtonSection: SectionComponent = ({ fields, renderLink }) => {
  const label = text(fields, "label");
  const mode = text(fields, "mode") || "link";
  if (mode !== "link") return <DisabledCta label={label} />;

  const { kind, href } = classifyHref(text(fields, "href"));
  if (kind === "unsafe") return <DisabledCta label={label} />;

  const newTab = text(fields, "linkTarget") === "new-tab";
  const spec: LinkSpec = {
    href,
    internal: kind === "internal",
    newTab,
    label,
    className: CTA_CLASS,
    children: label,
  };

  if (renderLink) return <>{renderLink(spec)}</>;

  // Fallback: a plain anchor (CMS preview, and the shell until it injects a renderer).
  return (
    <a
      href={href}
      className={CTA_CLASS}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
};

const CardSection: SectionComponent = ({ fields, slots }) => (
  <section className="border-border flex flex-col gap-3 rounded-[var(--radius)] border p-4">
    {slots.icon}
    {text(fields, "heading") && <h3 className="font-medium">{text(fields, "heading")}</h3>}
    {slots.body}
  </section>
);

export const SECTION_REGISTRY: Readonly<Record<string, SectionComponent>> = {
  hero: HeroSection,
  guidance: TitleBodySection,
  help: TitleBodySection,
  footer: FooterSection,
  icon: IconSection,
  text: TextSection,
  image: ImageSection,
  button: ButtonSection,
  card: CardSection,
};

function Placeholder({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed p-4 text-sm">
      {children}
    </div>
  );
}

/**
 * Renders one section: its component, fed a field bag and its already-rendered
 * slot children.
 *
 * A missing component or a genuinely empty instance is rendered visibly rather
 * than skipped — a route published against a key this build doesn't know, or a
 * leaf nobody has filled in yet for this locale, is a mistake worth seeing on
 * the page. But a composite whose own fields are all optional (`card`) may
 * legitimately carry no content bag of its own — its point is the slot
 * children — so an instance with anything slotted into it always renders,
 * `fields` defaulting to an empty bag.
 */
export function renderSection(
  sectionKey: string,
  fields: SectionFields,
  slots: Readonly<Record<string, React.ReactNode>> = {},
  route?: RouteRenderContext,
  renderLink?: RenderLink,
  data?: SectionDataEntry,
): React.JSX.Element {
  const Component = SECTION_REGISTRY[sectionKey];
  if (!Component) return <Placeholder>No section registered for “{sectionKey}”.</Placeholder>;

  const hasSlotChildren = Object.values(slots).some(
    (child) => child != null && (!Array.isArray(child) || child.length > 0),
  );
  if (!fields && !hasSlotChildren) {
    return <Placeholder>“{sectionKey}” has no content yet.</Placeholder>;
  }
  return (
    <Component
      fields={fields ?? {}}
      slots={slots}
      route={route}
      renderLink={renderLink}
      data={data}
    />
  );
}
