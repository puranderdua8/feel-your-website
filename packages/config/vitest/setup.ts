import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
// Type-only side effect: augments Vitest's `Assertion`/`AsymmetricMatchersContaining`
// interfaces with `toHaveNoViolations` so TypeScript recognizes the matcher
// registered below at runtime.
import "vitest-axe/extend-expect";

// Wire vitest-axe's custom matcher (toHaveNoViolations) globally.
expect.extend(axeMatchers);

// Ensure React Testing Library unmounts between tests.
afterEach(() => {
  cleanup();
});
