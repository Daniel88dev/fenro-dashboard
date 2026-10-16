import { handleAuthRequest } from "@/shared/infrastructure/container";

// `/api/auth/callback/github` is the callback URL the GitHub App points at.
export function GET(request: Request) {
  return handleAuthRequest(request);
}

export function POST(request: Request) {
  return handleAuthRequest(request);
}
