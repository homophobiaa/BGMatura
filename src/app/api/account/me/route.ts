import { getSignedInUser } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";
import { privateHeaders } from "@/server/http";

/**
 * Who is signed in, for the site header. It returns only the display name and the role, never the email, and it is
 * read by the browser after the page loads, so the public pages stay static and fast. Nobody signed in is an ordinary
 * answer (`user: null`); sign-in not being configured is `503`, and the header then hides the sign-in button.
 */
export async function GET(request: Request) {
  try {
    const user = await getSignedInUser(request.headers);
    return Response.json({ user: user === null ? null : { name: user.name, role: user.role } }, { headers: privateHeaders });
  } catch (error) {
    const status = error instanceof AdminConfigurationError ? 503 : 500;
    return Response.json({ error: "unavailable" }, { status, headers: privateHeaders });
  }
}
