import * as SelectPrimitive from "@radix-ui/react-select";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

const triggerVariants = cva(
  "flex h-9 w-full items-center justify-between rounded-[var(--radius)] border border-[var(--input-border)] bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-[length:var(--focus-ring-width)] focus:ring-[color:var(--focus-ring-color)] disabled:cursor-not-allowed disabled:opacity-50",
);

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} className={cn(triggerVariants(), className)} {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <span aria-hidden>▾</span>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const contentVariants = cva(
  "z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius)] border border-border bg-background text-foreground shadow-[var(--card-shadow)]",
);

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(contentVariants(), className)}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "focus:bg-accent relative flex w-full cursor-default select-none items-center rounded-[calc(var(--radius)-2px)] py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/**
 * NOTE: this whole module is an intentionally minimal placeholder stub for
 * the Phase 0 registry scaffold, wired to the real Radix primitive. A fully
 * a11y-audited implementation is explicit future work.
 */
