import type {
  Content,
  JsonValue,
  SectionDefinition,
  SectionSampleChild,
} from "@feel-your-website/content-core";
import { Fragment } from "react";

import { renderSection } from "./registry.js";

/**
 * Renders a catalog section on its own, with the dummy content declared in its
 * `SectionDefinition.sample`.
 *
 * This is the CMS "Sections" gallery's building block: a section is a
 * container, so the only way to show one is to feed it stand-in data. The
 * real data always comes from a route — this is just the shop window.
 */

/** Wraps sample fields in the `Content` shape `renderSection` expects. */
function sampleContent(sectionKey: string, fields: Readonly<Record<string, JsonValue>>): Content {
  return {
    templateKey: sectionKey,
    variant: "",
    // Not a real BCP-47 tag: nothing localises a gallery preview.
    locale: "sample",
    translated: true,
    fields,
    updatedAt: "",
  };
}

function renderSampleChild(child: SectionSampleChild): React.JSX.Element {
  const slots: Record<string, React.ReactNode> = {};
  for (const [name, kids] of Object.entries(child.slots ?? {})) {
    slots[name] = kids.map((kid, index) => (
      <Fragment key={index}>{renderSampleChild(kid)}</Fragment>
    ));
  }
  return renderSection(child.sectionKey, sampleContent(child.sectionKey, child.fields), slots);
}

/**
 * A section with no `sample` renders with no content — the registry shows its
 * own "no content yet" placeholder, which is the honest thing to display.
 */
export function renderSectionSample(def: SectionDefinition): React.JSX.Element {
  const slots: Record<string, React.ReactNode> = {};
  for (const [name, kids] of Object.entries(def.sample?.slots ?? {})) {
    slots[name] = kids.map((kid, index) => (
      <Fragment key={index}>{renderSampleChild(kid)}</Fragment>
    ));
  }
  return renderSection(
    def.key,
    def.sample ? sampleContent(def.key, def.sample.fields) : null,
    slots,
  );
}
