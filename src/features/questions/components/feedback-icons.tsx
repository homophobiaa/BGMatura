import type { ReactNode } from "react";

/**
 * Icons that accompany feedback text, so colour is never the only signal. They are decorative:
 * the visible label next to each one carries the meaning. Shapes follow the Lucide
 * `CircleCheck` and `CircleX` icons named in the design direction.
 */

interface IconProps {
  readonly className?: string;
}

function Icon({ className = "size-5", children }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CircleCheckIcon({ className }: IconProps) {
  return (
    <Icon {...(className ? { className } : {})}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function CircleXIcon({ className }: IconProps) {
  return (
    <Icon {...(className ? { className } : {})}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </Icon>
  );
}
