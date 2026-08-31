import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-9 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-[color:var(--focus-ring-color)] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      inputSize: {
        sm: "h-8 text-xs",
        default: "h-9",
        lg: "h-10 text-base",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

/**
 * NOTE: intentionally minimal placeholder stub for the Phase 0 registry
 * scaffold. A fully a11y-audited implementation is explicit future work.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(inputVariants({ inputSize }), className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { inputVariants };
