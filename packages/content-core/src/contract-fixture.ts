/**
 * The content every adapter under test must be seeded with.
 *
 * Deliberately in its own module, free of any test-framework import.
 *
 * The fixture is *data*, and it is needed by things that are not tests — the
 * memory adapter's seed, for one, which ships in the running app. Keeping it
 * beside the suite meant importing `contract-tests` (and therefore vitest)
 * from a runtime module, which broke the dev server with "Vitest failed to
 * access its internal state". The suite needs vitest; the data does not.
 *
 * Kept small and explicit: the contract is about behaviour, not about a rich
 * dataset.
 */
export const CONTRACT_FIXTURE = {
  /** Present in both `en` and `hi`. */
  translatedKey: "guidance",
  /** Present in `en` only — used to prove locale fallback. */
  untranslatedKey: "legal",
  /** Present in no locale — used to prove missing is not an error. */
  missingKey: "does-not-exist",
  defaultLocale: "en",
  otherLocale: "hi",
  /** Total number of content items across all template keys in `en`. */
  totalEnItems: 3,
} as const;
