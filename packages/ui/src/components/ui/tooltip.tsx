import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

const contentVariants = cva(
  "z-50 overflow-hidden rounded-[calc(var(--radius)-2px)] bg-foreground px-3 py-1.5 text-xs text-background shadow-[var(--card-shadow)]",
);

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(contentVariants(), className)}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * NOTE: this whole module is an intentionally minimal placeholder stub for
 * the Phase 0 registry scaffold, wired to the real Radix primitive. A fully
 * a11y-audited implementation is explicit future work.
 */
