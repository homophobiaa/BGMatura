import "server-only";
import { z } from "zod";

const requiredNames = ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_EMAILS"] as const;

export class AdminConfigurationError extends Error {
  constructor() { super("Admin authentication is not configured. Check the documented server environment variables."); }
}

function isAuthOrigin(value: string) {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" &&
    (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
}

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().refine(isAuthOrigin),
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ADMIN_EMAILS: z.string().transform((value) => value.split(",").map((email) => email.trim().toLowerCase()))
    .pipe(z.array(z.email()).min(1)),
});

export type AdminEnvironment = z.infer<typeof schema>;

export function hasAdminConfiguration(environment = process.env): boolean {
  return requiredNames.every((name) => Boolean(environment[name]));
}

export function getAdminEnvironment(environment: Record<string, string | undefined> = process.env): AdminEnvironment {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new AdminConfigurationError();
  return parsed.data;
}

export function isApprovedAdmin(email: string, verified: boolean, emails = getAdminEnvironment().ADMIN_EMAILS): boolean {
  return verified && emails.includes(email.trim().toLowerCase());
}
