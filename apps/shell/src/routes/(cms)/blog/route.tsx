// @generated — do not hand-edit.
// This file mirrors a published CMS route. Change it in the CMS, then run
// `pnpm --filter @feel-your-website/shell routes:sync` to update
// routes.snapshot.json, and `routes:generate` (or a full build) to
// regenerate this file. `routes:generate --check` fails CI on drift.

import { createFileRoute } from "@tanstack/react-router";

import { cmsHead, cmsLayoutRouteComponent, cmsLoader } from "@/cms-route";

export const Route = createFileRoute("/(cms)/blog")({
  loader: (ctx) => cmsLoader(ctx, "blog"),
  head: cmsHead,
  component: cmsLayoutRouteComponent(true),
});
