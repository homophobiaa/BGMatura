import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { AdminAuthorizationError } from "./authorization";
import { AdminConfigurationError } from "./environment";
import { EditorialError } from "@/server/editorial";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Vary": "Cookie",
  "X-Robots-Tag": "noindex, nofollow",
};

/** Stream into a bounded buffer instead of trusting Content-Length. */
export async function readEditorialJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    throw new EditorialError("invalid", "Send an application/json body.");
  }
  if (!request.body) throw new EditorialError("invalid", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new EditorialError("invalid", "The request exceeds the 64 KiB limit.");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new EditorialError("invalid", "Send valid UTF-8 JSON."); }
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
