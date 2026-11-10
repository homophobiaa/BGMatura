"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input, inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Label, hint, and server errors wired to one control with the matching ARIA attributes. */
function FieldFrame({ id, label, hint, errors, children }: { id: string; label: string; hint?: ReactNode; errors: readonly string[]; children: (describedBy: string | undefined) => ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-label text-ink">{label}</label>
    {hint && <p id={hintId} className="text-caption text-muted">{hint}</p>}
    {children(describedBy)}
    {errorId && <ul id={errorId} className="space-y-1 text-caption text-error">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
  </div>;
}

type FieldProps = { id: string; label: string; hint?: ReactNode; errors?: readonly string[] };

export function TextField({ id, label, hint, errors = [], className, ...props }: FieldProps & ComponentProps<"input">) {
  return <FieldFrame id={id} label={label} hint={hint} errors={errors}>
    {(describedBy) => <Input id={id} aria-describedby={describedBy} aria-invalid={errors.length > 0 || undefined} className={className} {...props} />}
  </FieldFrame>;
}

export function TextAreaField({ id, label, hint, errors = [], className, ...props }: FieldProps & ComponentProps<"textarea">) {
  return <FieldFrame id={id} label={label} hint={hint} errors={errors}>
    {(describedBy) => <textarea id={id} aria-describedby={describedBy} aria-invalid={errors.length > 0 || undefined}
      className={cn(inputClassName, "min-h-32 py-3", className)} {...props} />}
  </FieldFrame>;
}

export function SelectField({ id, label, hint, errors = [], className, children, ...props }: FieldProps & ComponentProps<"select">) {
  return <FieldFrame id={id} label={label} hint={hint} errors={errors}>
    {(describedBy) => <select id={id} aria-describedby={describedBy} aria-invalid={errors.length > 0 || undefined}
      className={cn(inputClassName, className)} {...props}>{children}</select>}
  </FieldFrame>;
}
