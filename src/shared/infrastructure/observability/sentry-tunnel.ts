type Send = (url: string, init: RequestInit) => Promise<Response>;

const RATE_LIMIT_HEADERS = ["retry-after", "x-sentry-rate-limits"];

export async function forwardSentryEnvelope(
  request: Request,
  configuredDsn: string | undefined,
  send: Send = fetch,
): Promise<Response> {
  const project = configuredDsn ? projectOf(configuredDsn) : null;
  if (!project) return new Response(null, { status: 404 });

  const envelope = new Uint8Array(await request.arrayBuffer());
  const target = projectOf(envelopeDsn(envelope) ?? "");
  // Only events for our own project pass, so the tunnel is not an open relay
  // into any Sentry project someone names.
  if (target?.host !== project.host || target.id !== project.id) {
    return new Response(null, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await send(project.envelopeUrl, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: envelope,
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  const headers = new Headers();
  for (const name of RATE_LIMIT_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

function envelopeDsn(envelope: Uint8Array): string | undefined {
  const end = envelope.indexOf(0x0a);
  const header = new TextDecoder().decode(
    end === -1 ? envelope : envelope.subarray(0, end),
  );
  try {
    const parsed: unknown = JSON.parse(header);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const dsn = (parsed as { dsn?: unknown }).dsn;
    return typeof dsn === "string" ? dsn : undefined;
  } catch {
    return undefined;
  }
}

function projectOf(dsn: string) {
  if (!URL.canParse(dsn)) return null;
  const url = new URL(dsn);
  const id = url.pathname.split("/").filter(Boolean).at(-1);
  if (!id) return null;
  return {
    host: url.host,
    id,
    envelopeUrl: `${url.protocol}//${url.host}/api/${id}/envelope/`,
  };
}
