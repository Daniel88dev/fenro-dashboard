/**
 * Where to send a request that reached the bare form of the app's host, such
 * as `fenro-dashboard.com` when APP_URL is `https://www.fenro-dashboard.com`.
 * Serving pages there would let a sign-in set cookies the www callback never
 * sees, so the bare domain only ever redirects. Any other host is left alone:
 * App Runner's health checks arrive on an internal address.
 */
export function bareDomainRedirect(
  requestUrl: string,
  host: string | null,
  appUrl: string,
): URL | undefined {
  const app = new URL(appUrl);
  if (!host || !app.hostname.startsWith("www.")) return undefined;

  const requestHost = host.split(":")[0].toLowerCase();
  if (requestHost !== app.hostname.slice("www.".length)) return undefined;

  const { pathname, search } = new URL(requestUrl);
  return new URL(`${pathname}${search}`, app.origin);
}
