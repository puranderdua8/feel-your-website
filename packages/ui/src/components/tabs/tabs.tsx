import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

export const Tabs = TabsPrimitive.Root;

const listVariants = cva(
  "inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-secondary p-1 text-foreground",
);

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn(listVariants(), className)} {...props} />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const triggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)-2px)] px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-[color:var(--focus-ring-color)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:shadow-[var(--card-shadow)]",
);

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(triggerVariants(), className)} {...props} />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-[color:var(--focus-ring-color)]",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * NOTE: this whole module is an intentionally minimal placeholder stub for
 * the Phase 0 registry scaffold, wired to the real Radix primitive. A fully
 * a11y-audited implementation is explicit future work.
 */
