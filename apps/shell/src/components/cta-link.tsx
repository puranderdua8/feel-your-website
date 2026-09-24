import type { LinkSpec, RenderLink } from "@feel-your-website/section-registry";
import type { ReactNode } from "react";

import { AppLink } from "@/components/app-link";

/**
 * The shell's CTA link renderer, injected into `renderComposition` as
 * `renderLink`. An internal same-tab link to a path is a TanStack `<Link>`
 * (client-side transition, intent preload); an external link, a new-tab
 * link, or a same-page `#fragment` / `?query` is a plain `<a>` with the usual
 * `rel` hardening. The shared section registry never has to know the router
 * exists.
 */
export const renderCtaLink: RenderLink = (spec: LinkSpec): ReactNode => {
  if (spec.route && !spec.newTab) {
    return (
      <AppLink route={spec.route} className={spec.className}>
        {spec.children}
      </AppLink>
    );
  }

  return (
    <a
      href={spec.href}
      className={spec.className}
      {...(spec.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {spec.children}
    </a>
  );
};
