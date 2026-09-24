import { normalizeRequestPath } from "@feel-your-website/content-core";
import type { ReactNode } from "react";

/**
 * An internal link's target, pre-split for a router: a host passes these
 * straight to its `<Link to search hash>` rather than re-parsing `href`.
 */
export interface InternalRoute {
  /** Normalised path (`normalizeRequestPath`) — no trailing slash, no `//`. */
  readonly pathname: string;
  /**
   * The raw query string including its `?`, or `""`. Kept raw on purpose: the
   * host parses it with its own router's search parser, so the rendered URL
   * round-trips to exactly what was authored.
   */
  readonly search: string;
  /** The fragment without its `#`, or `""`. */
  readonly hash: string;
}

/** What a host-injected link renderer is handed for one CTA. */
export interface LinkSpec {
  readonly href: string;
  /** True for an in-app route (`classifyHref` → `internal`). */
  readonly internal: boolean;
  /**
   * Present for an internal link to a path (`/…`); absent for an external
   * link and for a same-page `#fragment` / `?query`, which need no route change.
   */
  readonly route?: InternalRoute;
  /** Open in a new tab (`target="_blank" rel="noopener noreferrer"`). */
  readonly newTab: boolean;
  readonly label: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

/**
 * Renders a CTA link. Supplied by the host through `RenderCompositionOptions`
 * so the shared registry never has to import the router: the shell passes an
 * implementation that uses a client-side `<Link>` for `route && !newTab`,
 * the CMS passes a plain `<a>`, and when it is absent `ButtonSection` falls
 * back to a plain `<a>` itself.
 */
export type RenderLink = (spec: LinkSpec) => ReactNode;

export type HrefKind = "internal" | "external" | "unsafe";

export interface ClassifiedHref {
  readonly kind: HrefKind;
  /** The href to render. `""` when `kind === "unsafe"`. */
  readonly href: string;
  /** The split target of an internal path link — see {@link LinkSpec.route}. */
  readonly route?: InternalRoute;
}

/** URL schemes a CTA is allowed to point at. Everything else is `unsafe`. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Classifies a CTA's authored href — the XSS guard for CMS-authored links.
 *
 * - A leading `/` (not `//`), `#`, or `?` → `internal`; the path portion is
 *   run through `normalizeRequestPath`, and a `/…` link also gets a `route`.
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
    const [, path = "", search = "", fragment = ""] =
      /^([^?#]*)(\?[^#]*)?(?:#(.*))?$/.exec(trimmed) ?? [];
    const pathname = normalizeRequestPath(path).pathname;
    return {
      kind: "internal",
      href: pathname + search + (fragment ? `#${fragment}` : ""),
      route: { pathname, search, hash: fragment },
    };
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
