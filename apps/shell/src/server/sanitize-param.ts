/**
 * A route param is a raw URL segment. Reject anything that could smuggle
 * structure into a downstream string (path separators, C0/DEL control
 * characters) or is absurdly long. A rejected value fails the whole
 * resolution — the visitor gets `notFound()`, not a section quietly handed a
 * hostile string.
 */
export function sanitizeParam(value: string): string | null {
  if (value.length === 0 || value.length > 1024) return null;
  // A bare dot segment is a traversal token, not a slug.
  if (value === "." || value === "..") return null;
  // TanStack's router has already decoded the segment; a surviving `%`
  // therefore means a smuggled separator, not legitimate percent-encoding.
  if (value.includes("%")) return null;
  // Path separators (/ and \\), whitespace, and C0/DEL control characters —
  // never legitimate in one decoded path segment. Slug punctuation (- _ .)
  // and Unicode letters pass.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 32 || code === 127 || code === 47 || code === 92) return null;
  }
  return value;
}
