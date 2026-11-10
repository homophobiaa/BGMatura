import { listStudentHistory } from "@/features/attempts/server/history";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";
import { privateHeaders } from "@/server/http";

/** The signed-in student's own finished attempts, one page at a time. Nobody else's, whatever the query says. */
export async function GET(request: Request) {
  try {
    const user = await getSignedInUser(request.headers);
    if (user === null) return Response.json({ error: "unauthorized" }, { status: 401, headers: privateHeaders });
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    return Response.json(await listStudentHistory(user.id, cursor), { headers: privateHeaders });
  } catch (error) {
    const status = error instanceof AdminConfigurationError ? 503 : 500;
    return Response.json({ error: "unavailable" }, { status, headers: privateHeaders });
  }
}
