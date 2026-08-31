import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLocaleSwitch } from "@/i18n/strategy.ui";

/** Display names, in each language's own script. */
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
};

export interface LanguageSwitcherProps {
  locales: readonly string[];
  active: string;
}

/**
 * Switches the interface language and remembers the choice.
 *
 * Deliberately knows nothing about *how* that happens — whether the choice
 * is written to a cookie or expressed as a navigation is the strategy's
 * business (`@/i18n/strategy.ui`). This component only reports which
 * locale the user picked, which is why changing strategy does not touch it.
 */
export function LanguageSwitcher({ locales, active }: LanguageSwitcherProps) {
  const switchLocale = useLocaleSwitch();
  const [pending, setPending] = useState<string | null>(null);

  async function choose(locale: string) {
    if (locale === active || pending) return;

    setPending(locale);
    try {
      await switchLocale(locale);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === active ? "default" : "outline"}
          size="sm"
          // Announces the current choice to assistive tech, which a colour
          // change alone does not.
          aria-current={locale === active ? "true" : undefined}
          disabled={pending !== null}
          onClick={() => void choose(locale)}
        >
          {LOCALE_LABELS[locale] ?? locale}
        </Button>
      ))}
    </div>
  );
}
