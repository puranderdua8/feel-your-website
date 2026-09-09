---
"@feel-your-website/shell": patch
---

Add `assertSameOrigin()` (`apps/shell/src/server/http-guards.ts`) and call it
from `setLocale`. State-changing server functions now refuse a request whose
`Sec-Fetch-Site` / `Origin` / `Referer` does not show it came from this site —
defence in depth alongside the `SameSite=Lax` session cookie.

`mutating-fns.test.ts` greps `bff.ts` and fails if any
`createServerFn({ method: "POST" })` handler omits the guard, so the invariant
holds as `invokeAction` / `ingestAnalytics` land later. `isSameOrigin(headers)`
is a pure function with its own unit tests.
