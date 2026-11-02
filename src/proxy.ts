import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/shared/config/env";
import { bareDomainRedirect } from "@/shared/infrastructure/bare-domain-redirect";

// A permanent redirect that keeps the method, so an agent posting to the MCP
// endpoint on the bare domain lands on www unchanged.
export function proxy(request: NextRequest) {
  const target = bareDomainRedirect(
    request.url,
    request.headers.get("host"),
    getEnv().APP_URL,
  );
  if (target) return NextResponse.redirect(target, 308);
  // The router refreshes a task page behind a task dialog with that page as
  // Next-Url; intercepted, it answers with a dialog and the router reloads.
  if (request.headers.get("next-url") === request.nextUrl.pathname) {
    const headers = new Headers(request.headers);
    headers.delete("next-url");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}
