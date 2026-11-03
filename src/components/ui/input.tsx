import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const inputClassName = "min-h-11 w-full min-w-0 rounded-md border border-border-control bg-canvas px-3 py-2 text-body text-ink disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-error";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(inputClassName, className)} {...props} />;
}
