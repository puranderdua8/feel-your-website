import { CONTRACT_FIXTURE } from "@feel-your-website/content-core";

import type { MemoryContentSeed } from "./MemoryContentAdapter.js";

/**
 * The seed shaped to satisfy the shared contract suite.
 *
 * Exported rather than kept in the test file so the Supabase adapter's own
 * contract run can seed a real database from exactly the same data — the
 * suite is only meaningful if every adapter starts from identical content.
 */
export const contractSeed: MemoryContentSeed = {
  defaultLocale: CONTRACT_FIXTURE.defaultLocale,
  content: {
    // Translated into both locales.
    [CONTRACT_FIXTURE.translatedKey]: {
      en: { title: "Guidance", body: "Hold the device close." },
      hi: { title: "मार्गदर्शन", body: "डिवाइस को पास रखें।" },
    },
    // English only — proves locale fallback and the `translated: false` flag.
    [CONTRACT_FIXTURE.untranslatedKey]: {
      en: { title: "Legal", body: "Terms apply." },
    },
    // A third key so pagination has more than two items to walk.
    help: {
      en: { title: "Help", body: "Contact support." },
    },
  },
  // Keys deliberately match the i18n bootstrap set, so this fixture
  // demonstrates the real behaviour: CMS copy overriding the built-in
  // strings, in each locale. Keys that are absent here keep their bootstrap
  // text rather than disappearing.
  messages: {
    en: {
      "bootstrap.loading": "Loading…",
      "bootstrap.offline.body": "You are offline. Showing the last saved version.",
      "bootstrap.retry": "Try again",
      "bootstrap.forbidden.title": "Not available to you",
      "bootstrap.forbidden.body":
        "Your account does not have access to this. Ask an administrator if you need it.",
    },
    hi: {
      "bootstrap.loading": "लोड हो रहा है…",
      "bootstrap.offline.body": "आप ऑफ़लाइन हैं। अंतिम सहेजा गया संस्करण दिखाया जा रहा है।",
      "bootstrap.retry": "पुनः प्रयास करें",
      "bootstrap.forbidden.title": "आपके लिए उपलब्ध नहीं",
      "bootstrap.forbidden.body":
        "आपके खाते के पास इसकी अनुमति नहीं है। आवश्यकता हो तो व्यवस्थापक से संपर्क करें।",
    },
  },
  routes: [
    {
      id: "route-help",
      path: "/help",
      items: ["help"],
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};
