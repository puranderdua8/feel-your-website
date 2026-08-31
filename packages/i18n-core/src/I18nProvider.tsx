"use client";

import * as React from "react";
import { IntlProvider } from "use-intl";

import { mergeMessages, unflattenMessages } from "./bootstrap.js";

export interface I18nProviderProps {
  locale: string;
  /**
   * Messages fetched from the CMS. Layered over the bootstrap set, so the
   * tree renders correctly even before this resolves or if it fails.
   */
  messages?: Readonly<Record<string, string>> | null;
  /**
   * Fixed "now" for relative-time formatting. Passing it from the server
   * keeps SSR and hydration agreeing rather than differing by however long
   * the response took.
   */
  now?: Date;
  timeZone?: string;
  /**
   * Called when a message is missing or malformed. Wire this to your error
   * reporter; without it, missing keys are logged in development only.
   */
  onMissingMessage?: (error: Error) => void;
  children?: React.ReactNode;
}

/**
 * Wraps `use-intl` with the bootstrap fallback layered in.
 *
 * `use-intl` is a runtime formatter rather than a compile-time one, which is
 * the right shape here: messages arrive from the CMS at request time, so
 * there is nothing to extract at build time.
 */
export function I18nProvider({
  locale,
  messages,
  now,
  timeZone,
  onMissingMessage,
  children,
}: I18nProviderProps): React.JSX.Element {
  // Merge flat (keys are what the CMS stores and what callers reason about),
  // then unflatten once for the formatter, which treats dots as namespaces.
  const merged = React.useMemo(() => unflattenMessages(mergeMessages(messages)), [messages]);

  return (
    <IntlProvider
      locale={locale}
      messages={merged}
      now={now}
      timeZone={timeZone}
      // A missing key must never surface as an exception in front of a user.
      // It is reported to developers and rendered as the key itself only as a
      // last resort.
      //
      // `process.env.NODE_ENV` rather than `import.meta.env`: this is a
      // library, and reaching for a bundler-specific global would tie it to
      // whichever build tool the consumer happens to use.
      onError={(error) => {
        onMissingMessage?.(error);
        if (!onMissingMessage && process.env.NODE_ENV !== "production") {
          console.warn("[i18n]", error.message);
        }
      }}
      getMessageFallback={({ key }) => key}
    >
      {children}
    </IntlProvider>
  );
}

export { useTranslations, useFormatter, useLocale, useNow } from "use-intl";
