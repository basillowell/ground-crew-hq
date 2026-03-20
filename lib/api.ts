import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function notFound(entity = "Resource") {
  return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
}

export function unprocessable(msg: string) {
  return NextResponse.json({ error: msg }, { status: 422 });
}

export function serverError(err: unknown, label = "Request") {
  console.error(`[API] ${label}:`, err);
  const msg = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
