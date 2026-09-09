import { normalizeRequestPath } from "@feel-your-website/content-core";

export type HrefKind = "internal" | "external" | "unsafe";

export interface ClassifiedHref {
  readonly kind: HrefKind;
  /** The href to render. `""` when `kind === "unsafe"`. */
  readonly href: string;
}

/** URL schemes a CTA is allowed to point at. Everything else is `unsafe`. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Classifies a CTA's authored href — the XSS guard for CMS-authored links.
 *
 * - A leading `/` (not `//`), `#`, or `?` → `internal`; the path portion is
 *   run through `normalizeRequestPath`.
 * - An absolute URL with an `http` / `https` / `mailto` / `tel` scheme →
 *   `external`.
 * - Anything else — `javascript:`, `data:`, `vbscript:`, a protocol-relative
 *   `//host`, a bare relative `foo/bar`, a non-string, an empty value → `unsafe`,
 *   and the caller renders a disabled placeholder instead of a link.
 */
export function classifyHref(raw: unknown): ClassifiedHref {
  if (typeof raw !== "string") return { kind: "unsafe", href: "" };
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "unsafe", href: "" };

  if (trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return { kind: "internal", href: trimmed };
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    const [, path = "", suffix = ""] = /^([^?#]*)(.*)$/.exec(trimmed) ?? [];
    return { kind: "internal", href: normalizeRequestPath(path).pathname + suffix };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: "unsafe", href: "" };
  }
  return SAFE_SCHEMES.has(url.protocol)
    ? { kind: "external", href: trimmed }
    : { kind: "unsafe", href: "" };
}
