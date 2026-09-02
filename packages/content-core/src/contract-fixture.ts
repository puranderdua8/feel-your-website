/**
 * The locale configuration every adapter under test is seeded with.
 *
 * Deliberately in its own module, free of any test-framework import: it is
 * *data*, needed by things that are not tests — the memory adapter's seed,
 * which ships in the running app. Keeping it beside the suite meant importing
 * `contract-tests` (and therefore vitest) from a runtime module, which broke
 * the dev server with "Vitest failed to access its internal state".
 *
 * Small on purpose: since route content moved onto the route
 * (`route_section_content`) there is no section-content fixture to describe —
 * only which locales the suite exercises.
 */
export const CONTRACT_FIXTURE = {
  defaultLocale: "en",
  /** A second configured locale — used where the suite needs more than one. */
  otherLocale: "hi",
} as const;
