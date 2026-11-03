import { getAdminAuth } from "@/features/admin/server/auth";
import { privateHeaders } from "@/features/admin/server/http";
import { AdminConfigurationError } from "@/features/admin/server/environment";

async function handle(request: Request) {
  try {
    const response = await getAdminAuth().handler(request);
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  } catch (error) {
    return Response.json({ message: "Входът временно не е достъпен." }, {
      status: error instanceof AdminConfigurationError ? 503 : 500, headers: privateHeaders,
    });
  }
}

export const GET = handle;
export const POST = handle;
