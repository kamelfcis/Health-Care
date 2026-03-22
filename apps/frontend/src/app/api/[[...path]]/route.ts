import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-side proxy: browser calls same origin `/api/*` → forwards to Express backend.
 * Fixes 404 when NEXT_PUBLIC_* rewrites are missing at build time.
 * Set BACKEND_PROXY_ORIGIN or BACKEND_API_ORIGIN on the frontend Vercel project (no NEXT_PUBLIC needed).
 */
function getBackendOrigin(): string | null {
  const raw =
    process.env.BACKEND_PROXY_ORIGIN?.trim() ||
    process.env.BACKEND_API_ORIGIN?.trim() ||
    (process.env.NEXT_PUBLIC_API_BASE_URL?.trim().startsWith("http")
      ? (() => {
          try {
            return new URL(process.env.NEXT_PUBLIC_API_BASE_URL!.trim()).origin;
          } catch {
            return "";
          }
        })()
      : "");

  return raw ? raw.replace(/\/$/, "") : null;
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const origin = getBackendOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        message:
          "API proxy misconfigured. Set BACKEND_PROXY_ORIGIN (or BACKEND_API_ORIGIN) to your Express backend origin, e.g. https://your-backend.vercel.app"
      },
      { status: 503 }
    );
  }

  const subPath = pathSegments.length ? pathSegments.join("/") : "";
  const targetUrl = `${origin}/api/${subPath}${req.nextUrl.search}`;

  const headers = new Headers();
  const passThrough = [
    "authorization",
    "content-type",
    "accept",
    "accept-language",
    "cookie",
    "user-agent",
    "x-requested-with"
  ];
  for (const name of passThrough) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store"
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText
  });

  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade"
  ]);

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!hopByHop.has(lower)) {
      out.headers.set(key, value);
    }
  });

  return out;
}

type Params = { params: { path?: string[] } };

export async function GET(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
export async function POST(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
export async function PUT(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
export async function PATCH(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
export async function DELETE(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
export async function OPTIONS(req: NextRequest, ctx: Params) {
  return proxy(req, ctx.params.path ?? []);
}
