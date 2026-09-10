import type { LinkSpec, RenderLink } from "@feel-your-website/section-registry";
import { useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";

/**
 * The shell's CTA link renderer, injected into `renderComposition` as
 * `renderLink`. An internal same-tab link gets a client-side transition; an
 * external link, or anything opening in a new tab, is a plain `<a>` with the
 * usual `rel` hardening. The shared section registry never has to know the
 * router exists.
 */

function InternalCtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    // `history.push` takes a plain path — no need to prove `href` is a known
    // route at compile time, which a CMS-authored link never is.
    router.history.push(href);
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export const renderCtaLink: RenderLink = (spec: LinkSpec): ReactNode => {
  if (spec.internal && !spec.newTab && spec.href.startsWith("/")) {
    return (
      <InternalCtaLink href={spec.href} className={spec.className}>
        {spec.children}
      </InternalCtaLink>
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
