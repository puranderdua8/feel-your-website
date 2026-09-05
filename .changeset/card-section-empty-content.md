---
"@feel-your-website/section-registry": patch
"@feel-your-website/cms": patch
---

A `card` (or any composite section whose own fields are all optional) with
populated slots but no content bag of its own was unusable: the preview showed
"'card' has no content yet" and hid the slot children, and the publish
readiness check flagged the card as a blocking translation gap so the route
could never be published.

- **`renderSection`** now renders a section whenever it has slot children,
  even with an empty field bag — a composite's point is its slots, and an
  optional `heading` being blank is not "unfilled". The "has no content yet"
  placeholder still shows for a genuinely empty instance (no content _and_ no
  slotted children).
- **`checkRoutePublishReadiness`** now asks `validateSectionFields` whether an
  instance's content is complete for a locale instead of treating any empty
  bag as a gap. A section with no required fields is complete when empty; a
  section with required fields still reports each missing one (now by name
  rather than `"*"`).
