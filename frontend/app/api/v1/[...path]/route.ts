import type { NextResponse } from 'next/server';

import { forward } from '../../../../lib/server/bff';

/** Same-origin proxy to the FastAPI backend for routes not yet served by Next.js. */
export function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return handle(request, context);
}

export function POST(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return handle(request, context);
}

export function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return handle(request, context);
}

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await context.params;
  const search = new URL(request.url).search;
  return forward(request, path, search);
}
