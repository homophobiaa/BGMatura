import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// shadcn/ui button composition, themed for the approved BG Matura tokens.
export const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-5 py-3 text-label transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active aria-pressed:bg-primary-active",
        secondary: "border border-border-control bg-canvas text-ink hover:bg-surface-soft active:bg-surface-strong aria-pressed:bg-surface-strong",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; busy?: boolean };

export function Button({ className, variant, asChild = false, busy = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return <Slot data-slot="button" className={cn(buttonVariants({ variant, className }))} {...props}>{children}</Slot>;
  }
  return <button data-slot="button" className={cn(buttonVariants({ variant, className }))}
    disabled={disabled || busy} aria-busy={busy} {...props}>
    {busy && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
    {busy ? "Зареждане…" : children}
  </button>;
}
