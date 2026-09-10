---
"@feel-your-website/shell": patch
---

Add `build-action-body.ts` — the pure, authoritative request-body builder for a
mutation invoke. Not called yet.

Driven by `def.input` (the code-defined schema), never the authored mapping's
own keys: a tampered mapping cannot add undeclared inputs, point a `static`
value at something it shouldn't, or claim a disallowed source. `routeParam`
values come only from the resolved route params and are re-sanitised here;
`static` values are the published literal coerced to the input's type;
`formInput` values come only from the submitted form and only for declared
inputs. An input that can't be resolved is simply absent — `validateActionInput`
reports it rather than the builder throwing. 11 tamper tests.
