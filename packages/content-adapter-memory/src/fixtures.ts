import { CONTRACT_FIXTURE } from "@feel-your-website/content-core";

import type { MemoryContentSeed } from "./MemoryContentAdapter.js";

/**
 * The seed shaped to satisfy the shared contract suite.
 *
 * Exported rather than kept in the test file so the Supabase adapter's own
 * contract run can seed a real database from equivalent data — the suite is
 * only meaningful if every adapter starts from the same shape.
 */
export const contractSeed: MemoryContentSeed = {
  defaultLocale: CONTRACT_FIXTURE.defaultLocale,
  // Keys deliberately match the i18n bootstrap set, so this fixture
  // demonstrates the real behaviour: CMS copy overriding the built-in
  // strings, in each locale. Keys absent here keep their bootstrap text.
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
      // One root section, no slots — the flat case. The route owns its
      // content: the copy lives on the node, per locale.
      tree: [
        {
          instanceId: "help-root",
          sectionKey: "help",
          content: {
            en: { title: "Help", body: "Contact support." },
            hi: { title: "सहायता", body: "समर्थन से संपर्क करें।" },
          },
          slots: {},
        },
      ],
      seo: {
        en: { title: "Help — feel-your-website", description: "Get help and contact support." },
        hi: {
          title: "सहायता — feel-your-website",
          description: "सहायता पाएँ और समर्थन से संपर्क करें।",
        },
      },
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};
