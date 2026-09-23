import { handleAuthRequest } from "@/shared/infrastructure/container";

/**
 * Better Auth's endpoints, GitHub's OAuth callback among them:
 * `/api/auth/callback/github` is the URL the GitHub OAuth app points at.
 */
export function GET(request: Request) {
  return handleAuthRequest(request);
}

export function POST(request: Request) {
  return handleAuthRequest(request);
}
