import type { Content, JsonValue } from "@feel-your-website/content-core";

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

const ButtonSection: SectionComponent = ({ fields }) => (
  <a
    href={text(fields, "href") || "#"}
    className="bg-primary text-primary-foreground inline-flex w-fit items-center rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium"
  >
    {text(fields, "label")}
  </a>
);

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
 * Renders one section: its component, fed the resolved content and its
 * already-rendered slot children.
 *
 * A missing component or missing content is rendered visibly rather than
 * skipped — a route published against a key this build doesn't know, or a
 * variant nobody has filled in yet, is a mistake worth seeing on the page.
 */
export function renderSection(
  sectionKey: string,
  content: Content | null,
  slots: Readonly<Record<string, React.ReactNode>> = {},
): React.JSX.Element {
  const Component = SECTION_REGISTRY[sectionKey];
  if (!Component) return <Placeholder>No section registered for “{sectionKey}”.</Placeholder>;
  if (!content) return <Placeholder>“{sectionKey}” has no content yet.</Placeholder>;
  return <Component fields={content.fields} slots={slots} />;
}

/**
 * @deprecated Use `renderComposition` / `renderSection`. Kept while the shell
 * and CMS finish moving to the section-tree model; dropped in the B5 cleanup.
 */
export function renderTemplate(templateKey: string, content: Content | null): React.JSX.Element {
  return renderSection(templateKey, content);
}
