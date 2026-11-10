import { z } from "zod";
import { deleteAccountAndData } from "@/features/account/server/account-data";
import { AdminAuthorizationError, getSignedInUser, requireMutationOrigin } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";
import { privateHeaders, readBoundedJson } from "@/server/http";

const confirmation = z.strictObject({ confirm: z.literal(true) });

/**
 * "Изтрий профила и данните ми". Only the signed-in student's own account, from this site, with an explicit
 * confirmation in the body. The session cookie is cleared so the browser is signed out at once.
 */
export async function POST(request: Request) {
  try {
    requireMutationOrigin(request.headers);
    const user = await getSignedInUser(request.headers);
    if (user === null) return Response.json({ error: "unauthorized" }, { status: 401, headers: privateHeaders });
    if (!confirmation.safeParse(await readBoundedJson(request)).success) return Response.json({ error: "invalid" }, { status: 400, headers: privateHeaders });

    await deleteAccountAndData(user.id);
    const headers = new Headers(privateHeaders);
    for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token", "better-auth.session_data", "__Secure-better-auth.session_data"]) {
      headers.append("set-cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    }
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return Response.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });
    const status = error instanceof AdminConfigurationError ? 503 : 500;
    return Response.json({ error: "unavailable" }, { status, headers: privateHeaders });
  }
}
