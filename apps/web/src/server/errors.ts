import "server-only";
import { NextResponse } from "next/server";

const DEFAULT_CODE: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code || DEFAULT_CODE[status] || "error";
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Please sign in to continue", code?: string) => new HttpError(401, msg, code);
export const forbidden = (msg = "You do not have access to this resource", code?: string) =>
  new HttpError(403, msg, code);
export const notFound = (msg = "Not found", code?: string) => new HttpError(404, msg, code);
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);

/** `{ error: { message, code } }` response, the shape every client expects. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { message: err.message, code: err.code } }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: { message: "Something went wrong on our side. Please try again.", code: "server_error" } },
    { status: 500 },
  );
}

export const json = <T>(body: T, status = 200) => NextResponse.json(body, { status });
