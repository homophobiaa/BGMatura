import "server-only";
import { getAdminAuth } from "./auth";
import { getAdminEnvironment, isApprovedAdmin } from "./environment";

export class AdminAuthorizationError extends Error {
  constructor() { super("Admin access is required."); }
}

/** Always rechecks the database session and current allowlist; never accepts an identity from input. */
export async function requireAdmin(requestHeaders: Headers) {
  if (!requestHeaders.get("cookie")) throw new AdminAuthorizationError();
  const session = await getAdminAuth().api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
  if (!session || !isApprovedAdmin(session.user.email, session.user.emailVerified)) throw new AdminAuthorizationError();
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export function requireMutationOrigin(requestHeaders: Headers): void {
  if (requestHeaders.get("origin") !== new URL(getAdminEnvironment().BETTER_AUTH_URL).origin) {
    throw new AdminAuthorizationError();
  }
}
