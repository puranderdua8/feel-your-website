import { useTranslations } from "@feel-your-website/i18n-core/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * What a guarded route renders when the permission is absent.
 *
 * Deliberately an explanation rather than a redirect. A blank redirect leaves
 * someone wondering whether they mis-clicked, whether the feature exists, or
 * whether the app is broken. Saying "this exists and is not available to you"
 * is both kinder and more honest — and it is why `routeGuard` renders copy
 * instead of navigating away.
 *
 * The copy comes from the CMS, falling back to the bootstrap set.
 */
export function LockedBanner() {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bootstrap.forbidden.title")}</CardTitle>
        <CardDescription>{t("bootstrap.forbidden.body")}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
