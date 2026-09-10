import type { JsonValue } from "@feel-your-website/content-core";

import type { ActionCtaSpec, RenderActionCta } from "./action-cta.js";
import type { RouteRenderContext } from "./context.js";
import { classifyHref, type LinkSpec, type RenderLink } from "./link.js";
import { parseReleases } from "./section-data.js";

/** A section's rendered content: a plain field bag, or `null` when unfilled. */
export type SectionFields = Readonly<Record<string, JsonValue>> | null;

/**
 * What a section that pulls external data receives for its instance: the
 * already-parsed payload, a normalised failure, or `pending` while a
 * non-blocking section's data is still being fetched on the client. The BFF
 * aggregates the first two (see the query registry); a section renders a
 * fallback for a failure or an absent entry and a skeleton for `pending`.
 *
 * `data` is typed `JsonValue`, not `unknown`: it has crossed the BFF→client
 * JSON boundary as part of `RoutePage`, so it must be serialisable. A section
 * still narrows it to its own shape (its `project` already did the real work).
 */
export type SectionDataEntry =
  | { readonly ok: true; readonly data: JsonValue }
  | { readonly ok: false; readonly error: { readonly code: string } }
  | { readonly pending: true };

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
   * Host-injected renderer for a `mode: "action"` CTA (see
   * {@link RenderActionCta}). Absent in the CMS preview and until the shell
   * wires it — `ButtonSection` then renders the disabled placeholder.
   */
  renderActionCta?: RenderActionCta;
  /**
   * This section's instance id from the route tree. Passed so an action CTA
   * can tell the server which node fired. Absent when a section is rendered
   * outside a composition (the CMS section gallery, a unit test).
   */
  instanceId?: string;
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

/** A CTA that can't render interactively (unsafe href, or `action` mode with no host renderer). */
function DisabledCta({ label }: { label: string }): React.JSX.Element {
  return (
    <span className={`${CTA_CLASS} cursor-not-allowed opacity-50`} aria-disabled="true">
      {label}
    </span>
  );
}

/**
 * A call-to-action. `mode: "link"` (the default) renders an internal or
 * external link. `mode: "action"` renders the host-injected
 * {@link RenderActionCta} — an interactive form that fires a registered
 * mutation — or the disabled placeholder when no host renderer is present
 * (the CMS preview, the section gallery). An unsafe href renders the
 * placeholder too.
 */
const ButtonSection: SectionComponent = ({ fields, renderLink, renderActionCta, instanceId }) => {
  const label = text(fields, "label");
  const mode = text(fields, "mode") || "link";

  if (mode === "action") {
    const actionId = text(fields, "actionId");
    if (!renderActionCta || instanceId === undefined || actionId === "") {
      return <DisabledCta label={label} />;
    }
    const spec: ActionCtaSpec = {
      instanceId,
      actionId,
      label,
      successLabel: text(fields, "successLabel") || undefined,
      body: fields.body ?? null,
      className: CTA_CLASS,
    };
    return <>{renderActionCta(spec)}</>;
  }

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

/**
 * The worked example of a data-backed section: it renders the list handed to
 * it in `data`, not anything from its own `fields` (bar a heading). The BFF
 * ran its query (`feed.releases`) during `loadRoutePage` and already narrowed
 * the payload via the section's `project`; `data` re-parses defensively since
 * the prop is typed `JsonValue`. `{ pending: true }` (a non-blocking fetch
 * still in flight) renders a fixed-height skeleton so the layout doesn't
 * shift; an absent entry, `{ ok: false }`, or an unparseable payload all fall
 * back to a single line — the page still renders.
 */
const ReleaseFeedSection: SectionComponent = ({ fields, data }) => {
  const heading = text(fields, "heading");
  const releases = data && "ok" in data && data.ok ? parseReleases(data.data) : null;
  const pending = Boolean(data && "pending" in data);

  return (
    <section className="flex flex-col gap-3">
      {heading && <h2 className="text-xl font-medium">{heading}</h2>}
      {pending ? (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex flex-col gap-1">
              <span className="bg-muted h-4 w-2/3 rounded" />
              <span className="bg-muted h-3 w-24 rounded" />
            </li>
          ))}
        </ul>
      ) : releases && releases.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {releases.map((release) => (
            <li key={release.url} className="flex flex-col">
              <a href={release.url} className="font-medium underline">
                {release.title}
              </a>
              <span className="text-muted-foreground text-sm">{release.date}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Release notes are unavailable right now.</p>
      )}
    </section>
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
  "release-feed": ReleaseFeedSection,
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
/** Everything past `slots` a section may be rendered with — all host-injected, all optional. */
export interface RenderSectionExtras {
  readonly route?: RouteRenderContext;
  readonly renderLink?: RenderLink;
  readonly renderActionCta?: RenderActionCta;
  readonly data?: SectionDataEntry;
  readonly instanceId?: string;
}

export function renderSection(
  sectionKey: string,
  fields: SectionFields,
  slots: Readonly<Record<string, React.ReactNode>> = {},
  extras: RenderSectionExtras = {},
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
      route={extras.route}
      renderLink={extras.renderLink}
      renderActionCta={extras.renderActionCta}
      instanceId={extras.instanceId}
      data={extras.data}
    />
  );
}
