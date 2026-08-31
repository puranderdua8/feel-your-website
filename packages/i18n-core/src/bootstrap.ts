/**
 * The only user-facing strings compiled into the app.
 *
 * This platform's rule is that all copy comes from the CMS. These are the
 * base case of that rule rather than an exception to it: they are what
 * renders *before* the CMS has answered, or when it is unreachable on a cold
 * cache — the loading state, the offline state, the error boundary, the retry
 * button. Without them a CMS outage renders a wordless app, and the very
 * screen that should explain the problem is the one that cannot.
 *
 * Kept deliberately tiny and generic. If you find yourself wanting to add
 * product copy here, that copy belongs in the CMS.
 *
 * CMS messages override these by key the moment they load.
 */
export const BOOTSTRAP_MESSAGES: Readonly<Record<string, string>> = {
  "bootstrap.loading": "Loading…",
  "bootstrap.offline.title": "No connection",
  "bootstrap.offline.body": "You are offline. Showing the last saved version.",
  "bootstrap.error.title": "Something went wrong",
  "bootstrap.error.body": "The page could not be loaded.",
  "bootstrap.retry": "Try again",
  "bootstrap.update.body": "A new version is available.",
  "bootstrap.update.action": "Reload",
  "bootstrap.notFound.title": "Page not found",
  "bootstrap.notFound.body": "That page does not exist.",
  "bootstrap.forbidden.title": "Not available to you",
  "bootstrap.forbidden.body":
    "Your account does not have access to this. Ask an administrator if you need it.",
  "bootstrap.signIn": "Sign in",
  "bootstrap.signOut": "Sign out",
  "bootstrap.language": "Language",
  "bootstrap.skipToContent": "Skip to content",
};

/**
 * Layers CMS messages over the bootstrap set.
 *
 * CMS wins on every key it defines, so any bootstrap string can be reworded
 * or translated without a release. Keys the CMS does not define keep the
 * built-in text rather than disappearing — a missing key must never render as
 * a raw key or an empty element.
 */
export function mergeMessages(
  cmsMessages: Readonly<Record<string, string>> | null | undefined,
): Record<string, string> {
  return { ...BOOTSTRAP_MESSAGES, ...(cmsMessages ?? {}) };
}

/** Bootstrap keys, for tests that assert nothing else is hard-coded. */
export const BOOTSTRAP_KEYS = Object.keys(BOOTSTRAP_MESSAGES);

export type NestedMessages = { [key: string]: string | NestedMessages };

/**
 * Converts flat dotted keys into the nested shape the formatter expects.
 *
 * The two sides genuinely want different shapes, and both are right. A CMS
 * stores messages as rows — one key, one value, one locale — so a flat
 * `Record<string, string>` is the natural wire format and keeps the
 * `ContentAdapter` contract simple. `use-intl`, meanwhile, treats a dot as a
 * namespace separator and looks up `bootstrap.loading` as
 * `messages.bootstrap.loading`, so a flat map silently resolves to nothing.
 *
 * Rather than force either side to change, this translates between them at
 * the one point that touches both.
 *
 * Where a key is both a leaf and a branch (`a` and `a.b` both defined), the
 * branch wins and the leaf is dropped — a namespace cannot also be a string,
 * and dropping the leaf is the outcome that keeps its children reachable.
 */
export function unflattenMessages(flat: Readonly<Record<string, string>>): NestedMessages {
  const root: NestedMessages = {};

  // Longest keys first, so deeper branches are created before a shorter key
  // could occupy the same slot as a plain string.
  for (const key of Object.keys(flat).sort((a, b) => b.length - a.length)) {
    const segments = key.split(".");
    const leaf = segments.pop() as string;

    let node = root;
    let blocked = false;

    for (const segment of segments) {
      const existing = node[segment];
      if (typeof existing === "string") {
        blocked = true;
        break;
      }
      node = (existing ?? (node[segment] = {})) as NestedMessages;
    }

    if (blocked) continue;
    if (typeof node[leaf] === "object") continue;

    node[leaf] = flat[key] as string;
  }

  return root;
}
