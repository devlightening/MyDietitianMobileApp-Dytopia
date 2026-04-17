import { NextRequest, NextResponse } from "next/server";
import { getInternalApiBaseUrl } from "@/lib/server-api";

export const runtime = "nodejs";

// Hop-by-hop headers that should not be forwarded
const DROP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

async function proxy(req: NextRequest) {
  // Resolved per-request so env var changes (e.g. hot-reload in dev) are picked up.
  const BACKEND_URL = getInternalApiBaseUrl();

  if (!BACKEND_URL) {
    return NextResponse.json({ message: "BACKEND_URL is not set" }, { status: 500 });
  }

  const { pathname, search } = req.nextUrl;
  let backendPath = pathname;

  // Path mapping: Frontend → Backend
  // Map frontend paths to backend paths if they differ
  if (backendPath === "/api/recipes") {
    backendPath = "/api/dietitian/recipes";
  }

  const target = new URL(BACKEND_URL);
  target.pathname = backendPath;
  target.search = search;

  // Copy headers, excluding hop-by-hop headers
  const headers = new Headers(req.headers);
  DROP_HEADERS.forEach((h) => headers.delete(h));

  // Get request body for non-GET/HEAD requests
  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer();

  try {
    const res = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    // Copy response headers, excluding hop-by-hop headers
    const resHeaders = new Headers(res.headers);
    DROP_HEADERS.forEach((h) => resHeaders.delete(h));

    return new NextResponse(res.body, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { message: "Failed to proxy request to backend" },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
