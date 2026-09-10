const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const LONG_NUMBER_RE = /\b\d{7,}\b/g;

/** Cap for any free-text field carried on an event (e.g. a click label). */
export const MAX_TEXT_LEN = 80;

/**
 * Scrubs a free-text value: emails and long digit runs become placeholders,
 * whitespace is collapsed, and the result is length-capped. Applied to every
 * human-readable string before it leaves the page.
 */
export function redactText(value: string): string {
  const scrubbed = value
    .replace(EMAIL_RE, "[email]")
    .replace(LONG_NUMBER_RE, "[number]")
    .replace(/\s+/g, " ")
    .trim();
  return scrubbed.length > MAX_TEXT_LEN ? `${scrubbed.slice(0, MAX_TEXT_LEN - 1)}…` : scrubbed;
}

/**
 * Groups a pathname for analytics: strips query + fragment and replaces any
 * high-cardinality segment (a long hex/uuid, or a 4+ digit run) with `:id`, so
 * `/orders/48213` and `/orders/48999` land on one row.
 */
export function redactPath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  return clean
    .split("/")
    .map((segment) =>
      /^[0-9a-f-]{8,}$/i.test(segment) || /^\d{4,}$/.test(segment) ? ":id" : segment,
    )
    .join("/");
}
