import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { AdminAuthorizationError } from "./authorization";
import { AdminConfigurationError } from "./environment";
import { EditorialError } from "@/server/editorial";
import { InvalidJsonError, privateHeaders, readBoundedJson } from "@/server/http";

export { privateHeaders } from "@/server/http";

export async function readEditorialJson(request: Request): Promise<unknown> {
  try {
    return await readBoundedJson(request);
  } catch (error) {
    if (error instanceof InvalidJsonError) throw new EditorialError("invalid", error.message);
    throw error;
  }
}

export async function editorialResponse(operation: () => Promise<unknown>): Promise<Response> {
  try { return Response.json({ record: await operation() }, { headers: privateHeaders }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "not-found", message: "Записът не е намерен." }, { status: 404, headers: privateHeaders });
    if (error instanceof AdminAuthorizationError) return Response.json({ error: "unauthorized", message: "Нямаш достъп до администрацията." }, { status: 401, headers: privateHeaders });
    if (error instanceof AdminConfigurationError) return Response.json({ error: "unavailable", message: "Администрацията временно не е достъпна." }, { status: 503, headers: privateHeaders });
    if (error instanceof EditorialError) {
      const status = error.code === "not-found" ? 404 : error.code === "invalid" ? 400 : 409;
      return Response.json({ error: error.code, message: error.message, fields: error.fields }, { status, headers: privateHeaders });
    }
    return Response.json({ error: "unavailable", message: "Операцията не бе изпълнена. Опитай отново." }, { status: 500, headers: privateHeaders });
  }
}
