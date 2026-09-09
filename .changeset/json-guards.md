---
"@feel-your-website/json-guards": minor
---

New package `@feel-your-website/json-guards` — tiny zero-dependency typed guards
for coercing untrusted JSON into a known shape or `null`.

`Guard<T>`, `isString`, `isNumber` (finite only), `isBoolean`, `isObject`
(non-null, non-array), `arrayOf`, `objectOf`, `field(obj, key, guard)`, and
`parse(value, guard)`. Not a schema library: no messages, no coercion, no async.
It exists so a hand-written `parseResult` stays short while still narrowing
precisely, keeping loosely-typed external data out of components.

Nothing consumes it yet.
