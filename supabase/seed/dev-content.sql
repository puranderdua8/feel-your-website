-- Local development messages, mirroring content-adapter-memory's fixture
-- (packages/content-adapter-memory/src/fixtures.ts) key for key.
--
-- The point is parity: `CONTENT_ADAPTER=memory` and `CONTENT_ADAPTER=supabase`
-- should render the same home page locally, so switching one env var is
-- actually a way to compare the two adapters rather than a way to get a
-- blank page. Hand-maintained rather than generated — unlike
-- `seed/permissions.sql`, there is no single source of truth to generate
-- this from; the memory fixture and this file are two independent adapters'
-- test data that happen to describe the same content.
--
-- `content_items` deliberately has no equivalent seed here. Nothing in
-- `apps/shell` reads it yet — `loadContent`/`getContent` are wired in the
-- BFF but no route calls them — and `content-adapter-supabase`'s own
-- contract test seeds and tears down its own `content_items` fixture rows
-- under the same key names content-core's `CONTRACT_FIXTURE` defines
-- (`guidance`, `legal`). Duplicating those names here previously caused a
-- primary-key collision between this seed and that test's `beforeAll` —
-- caught by actually running the contract suite against a freshly-seeded
-- database, not merely by each piece working in isolation.
--
-- Local dev and CI only: `supabase/config.toml`'s `db.seed` step (which runs
-- this) has no equivalent against a hosted project — nothing here reaches
-- a deployed Supabase project via Terraform or a migration.

insert into public.content_messages (locale, key, value) values
  ('en', 'bootstrap.loading',         'Loading…'),
  ('en', 'bootstrap.offline.body',    'You are offline. Showing the last saved version.'),
  ('en', 'bootstrap.retry',           'Try again'),
  ('en', 'bootstrap.forbidden.title', 'Not available to you'),
  ('en', 'bootstrap.forbidden.body',
    'Your account does not have access to this. Ask an administrator if you need it.'),
  ('hi', 'bootstrap.loading',         'लोड हो रहा है…'),
  ('hi', 'bootstrap.offline.body',    'आप ऑफ़लाइन हैं। अंतिम सहेजा गया संस्करण दिखाया जा रहा है।'),
  ('hi', 'bootstrap.retry',           'पुनः प्रयास करें'),
  ('hi', 'bootstrap.forbidden.title', 'आपके लिए उपलब्ध नहीं'),
  ('hi', 'bootstrap.forbidden.body',
    'आपके खाते के पास इसकी अनुमति नहीं है। आवश्यकता हो तो व्यवस्थापक से संपर्क करें।')
on conflict (locale, key) do update set value = excluded.value;
