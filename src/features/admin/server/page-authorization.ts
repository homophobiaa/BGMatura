import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAuthorizationError, requireAdmin } from "./authorization";
import { AdminConfigurationError } from "./environment";

/**
 * For admin pages and layouts: returns the request headers and the signed-in admin,
 * or sends the visitor to the sign-in page. Every admin page calls this itself,
 * because a layout check alone does not protect a page.
 */
export async function requireAdminPage() {
  const requestHeaders = new Headers(await headers());
  try {
    const admin = await requireAdmin(requestHeaders);
    return { admin, requestHeaders };
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof AdminConfigurationError) redirect("/admin/sign-in");
    throw error;
  }
}
