import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { InvalidJsonError, privateHeaders } from "@/server/http";
import { getSiteOrigin } from "@/server/site-origin";
import { AttemptError } from "./errors";
import type { AttemptAccess } from "./persistence";

function isLoopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function trustedOrigin(request: NextRequest): URL {
  const requestUrl = new URL(request.url);
  const localOrigin = process.env.NODE_ENV !== "production" && isLoopback(requestUrl) ? requestUrl : undefined;
  const origin = getSiteOrigin() ?? localOrigin;
  if (!origin || (origin.protocol !== "https:" && !isLoopback(origin))) throw new AttemptError("unavailable");
  return origin;
}

export function requireAttemptOrigin(request: NextRequest) {
  const origin = trustedOrigin(request);
  if (request.headers.get("origin") !== origin.origin) throw new AttemptError("origin");
  return origin;
}

function cookieName(origin: URL) {
  return origin.protocol === "https:" ? "__Secure-bgm_attempt" : "bgm_attempt";
}

export function attemptAccess(request: NextRequest, id: string): AttemptAccess {
  return { id, token: request.cookies.get(cookieName(trustedOrigin(request)))?.value };
}

export function attemptJson(data: unknown, status = 200) {
  return NextResponse.json(data, { headers: privateHeaders, status });
}

export function createdAttemptResponse(attempt: { id: string; accessUntil: Date; token: string }, origin: URL) {
  const response = attemptJson({ id: attempt.id }, 201);
  response.cookies.set(cookieName(origin), attempt.token, {
    httpOnly: true,
    secure: origin.protocol === "https:",
    sameSite: "lax",
    path: `/api/attempts/${attempt.id}`,
    expires: attempt.accessUntil,
  });
  return response;
}

const failure = {
  "not-found": { status: 404, message: "Записът не е достъпен. За изгубен или изтекъл опит започни нов." },
  "invalid": { status: 400, message: "Провери изпратените данни." },
  "no-questions": { status: 409, message: "За тази тема все още няма достъпни въпроси. Избери друга тема." },
  "closed": { status: 409, message: "Опитът приключи. Отвори го отново, за да видиш резултата." },
  "conflict": { status: 409, message: "Записът е променен. Презареди и опитай отново." },
  "origin": { status: 403, message: "Заявката е отказана." },
  "unavailable": { status: 503, message: "Услугата временно не е достъпна." },
};

export async function attemptResponse(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    const code = error instanceof AttemptError ? error.code : error instanceof InvalidJsonError ? "invalid" : undefined;
    if (!code) return attemptJson({ error: "internal", message: "Операцията не бе изпълнена. Опитай отново." }, 500);
    const { message, status } = failure[code];
    return attemptJson({ error: code, message }, status);
  }
}
