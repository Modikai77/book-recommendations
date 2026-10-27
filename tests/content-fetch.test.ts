import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentFetchError, fetchReadableContent, sourceErrorDiagnostics } from "@/lib/content-fetch";

const articleUrl = "https://marginalrevolution.com/marginalrevolution/2026/10/tyler-cowens-strongest-book-recommendations-over-the-years.html";

afterEach(() => vi.unstubAllGlobals());

describe("web source retrieval diagnostics", () => {
  it("records upstream HTTP details without cookies or URL secrets", async () => {
    const response = new Response("private response body", {
      status: 403,
      statusText: "Forbidden",
      headers: { "content-type": "text/html; charset=UTF-8", "set-cookie": "session=COOKIE_SECRET" }
    });
    Object.defineProperty(response, "url", { value: `${articleUrl}?token=REDIRECT_SECRET` });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetchReadableContent(`${articleUrl}?key=URL_SECRET`).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ContentFetchError);
    const diagnostics = sourceErrorDiagnostics(error);
    expect(diagnostics.upstream).toEqual({
      requestedUrl: articleUrl,
      finalUrl: articleUrl,
      status: 403,
      statusText: "Forbidden",
      contentType: "text/html; charset=UTF-8"
    });
    expect(diagnostics.cause).toMatchObject({ message: "Upstream returned HTTP 403 Forbidden" });
    expect(JSON.stringify(diagnostics)).not.toMatch(/COOKIE_SECRET|REDIRECT_SECRET|URL_SECRET|private response body/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { "User-Agent": "BookRecommendationsBot/1.0" } });
  });

  it("preserves the original transport exception and nested cause", async () => {
    const dnsError = Object.assign(new Error("getaddrinfo ENOTFOUND marginalrevolution.com"), { code: "ENOTFOUND" });
    const transportError = new TypeError("fetch failed", { cause: dnsError });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(transportError));

    const error = await fetchReadableContent(articleUrl).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ContentFetchError);
    expect((error as ContentFetchError).cause).toBe(transportError);
    expect(sourceErrorDiagnostics(error)).toMatchObject({
      cause: { name: "TypeError", message: "fetch failed", cause: { code: "ENOTFOUND" } }
    });
  });

  it("keeps HTTP context and the original exception when reading the body fails", async () => {
    const bodyError = new Error("terminated");
    const response = new Response("", { headers: { "content-type": "text/html" } });
    vi.spyOn(response, "text").mockRejectedValue(bodyError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const error = await fetchReadableContent(articleUrl).catch((error: unknown) => error);
    expect((error as ContentFetchError).cause).toBe(bodyError);
    expect(sourceErrorDiagnostics(error)).toMatchObject({ upstream: { status: 200, contentType: "text/html" } });
  });

  it("redacts credentials in error messages and ignores arbitrary request properties", () => {
    const error = Object.assign(new Error("fetch https://user:URL_PASSWORD@example.com/article?key=QUERY_SECRET\nCookie: sid=COOKIE_SECRET\nAuthorization: Bearer AUTH_SECRET"), {
      headers: { cookie: "COOKIE_SECRET" },
      cause: new Error("api_key=KEY_SECRET\npostgresql://dbuser:DB_PASSWORD@example.com/books?token=DB_TOKEN\nclient_secret=CLIENT_SECRET")
    });
    const logged = JSON.stringify(sourceErrorDiagnostics(error));
    expect(logged).not.toMatch(/URL_PASSWORD|QUERY_SECRET|COOKIE_SECRET|AUTH_SECRET|KEY_SECRET|DB_PASSWORD|DB_TOKEN|CLIENT_SECRET/);
    expect(logged).toContain("https://example.com/article");
  });

  it("still extracts readable content from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "<title>Book ideas &amp; reviews</title><article><p>Small Things Like These by Claire Keegan</p></article><script>private()</script>",
      { headers: { "content-type": "text/html" } }
    )));
    const content = await fetchReadableContent(articleUrl);
    expect(content.title).toBe("Book ideas & reviews");
    expect(content.textContent).toContain("Small Things Like These by Claire Keegan");
    expect(content.textContent).not.toContain("private()");
  });
});
