// vitest-axe@0.1.0 ships type augmentation for an older Vitest typings
// layout (`declare global { namespace Vi { interface Assertion ... } } }`)
// that no longer matches how Vitest 2.x's `Assertion` interface is declared
// (it now lives in `@vitest/expect`, augmented as `interface Assertion<T>`
// with no default type param — matched exactly below). The runtime matcher
// registered via `expect.extend(...)` in the shared Vitest setup works
// regardless — this file only re-declares the type.
import "vitest";

declare module "@vitest/expect" {
  // The real `Assertion<T>` interface this augments takes a type parameter;
  // declaration merging requires matching that arity exactly even though the
  // matcher we're adding doesn't use it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T> {
    toHaveNoViolations(): void;
  }
}
