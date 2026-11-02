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
  return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}
