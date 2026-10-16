import { describe, expect, it } from "vitest";

import { bareDomainRedirect } from "./bare-domain-redirect";

const APP_URL = "https://www.fenro-dashboard.com";

describe("bareDomainRedirect", () => {
  it("sends the bare domain to www, keeping the path and query", () => {
    const target = bareDomainRedirect(
      "http://0.0.0.0:3000/tasks/T-12?from=dialog",
      "fenro-dashboard.com",
      APP_URL,
    );

    expect(target?.href).toBe(
      "https://www.fenro-dashboard.com/tasks/T-12?from=dialog",
    );
  });

  it("ignores letter case and a port in the Host header", () => {
    const target = bareDomainRedirect(
      "http://0.0.0.0:3000/",
      "Fenro-Dashboard.com:443",
      APP_URL,
    );

    expect(target?.href).toBe("https://www.fenro-dashboard.com/");
  });

  it("leaves the app's own host alone", () => {
    expect(
      bareDomainRedirect(
        "https://www.fenro-dashboard.com/",
        "www.fenro-dashboard.com",
        APP_URL,
      ),
    ).toBeUndefined();
  });

  it("leaves other hosts alone, such as App Runner's health checks", () => {
    expect(
      bareDomainRedirect(
        "http://10.0.0.5:3000/api/health",
        "10.0.0.5:3000",
        APP_URL,
      ),
    ).toBeUndefined();
    expect(
      bareDomainRedirect("http://localhost:3000/", null, APP_URL),
    ).toBeUndefined();
  });

  it("does nothing when the app is not served on www", () => {
    expect(
      bareDomainRedirect(
        "http://localhost:3000/",
        "localhost:3000",
        "http://localhost:3000",
      ),
    ).toBeUndefined();
  });
});
