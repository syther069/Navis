import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest, NextResponse } from "@workspace/navis-core/server/http";
import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { POST as nonce } from "./api/auth/nonce/route";
import { GET as session } from "./api/auth/session/route";
import { workspace, workspaceStorageErrorResponse } from "./workspace";

test("native request adapter isolates cookies and preserves JSON", async () => {
  const request = new NextRequest("https://navis.example/api/auth/verify", {
    method: "POST",
    headers: { cookie: "other=1; navis_session=hello%20world", "content-type": "application/json" },
    body: '{"wallet":"unchanged"}',
  });
  assert.equal(request.cookies.get("navis_session")?.value, "hello world");
  assert.equal(request.cookies.get("missing"), undefined);
  assert.deepEqual(await request.json(), { wallet: "unchanged" });
});

test("session response preserves HttpOnly, Secure, SameSite and seconds max-age", async () => {
  const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set("navis_session", "token", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 });
  const cookie = response.headers.getSetCookie()[0];
  for (const expected of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=60"]) assert.ok(cookie.includes(expected));
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("CSRF rejects missing and foreign origins before authentication", async () => {
  const missing = new NextRequest("https://navis.example/api/auth/nonce", { method: "POST" });
  assert.equal(hasTrustedMutationOrigin(missing), false);
  assert.equal((await nonce(missing)).status, 403);
  const foreign = new NextRequest("https://navis.example/api/auth/nonce", { method: "POST", headers: { origin: "https://attacker.example" } });
  assert.equal((await nonce(foreign)).status, 403);
  const same = new NextRequest("https://navis.example/api/auth/nonce", { headers: { origin: "https://navis.example" } });
  assert.equal(hasTrustedMutationOrigin(same), true);
});

test("unauthenticated session is private and owner page cannot expose records", async () => {
  const result = await session(new NextRequest("https://navis.example/api/auth/session"));
  assert.equal(result.status, 200);
  assert.ok(result.headers.get("cache-control")?.includes("no-store"));
  const owned = await workspace(new NextRequest("https://navis.example/api/workspace?path=/agents/private-agent"));
  assert.equal(owned.status, 401);
  const list = await workspace(new NextRequest("https://navis.example/api/workspace?path=/agents"));
  assert.deepEqual((await list.json()).ownedAgents, []);
  const unknown = await workspace(new NextRequest("https://navis.example/api/workspace?path=/unknown"));
  assert.equal(unknown.status, 404);
});

test("fixture data is returned only on explicitly marked demo paths", async () => {
  const result = await workspace(new NextRequest("https://navis.example/api/workspace?path=/agents/atlas"));
  const body = await result.json();
  assert.equal(body.demo, true);
  assert.equal(body.source, "demo_fixture");
  assert.equal(body.demoProof.document.mode, "demo");
  const home = await workspace(new NextRequest("https://navis.example/api/workspace?path=/"));
  assert.equal((await home.json()).demoProof, undefined);
});

test("missing NAVIS schema is a private 503, not an empty list or leaked driver error", async () => {
  const response = workspaceStorageErrorResponse({
    message: "Failed query containing sensitive connection information",
    cause: { code: "42P01", message: 'relation "decisions" does not exist', detail: "secret-password" },
  });
  assert.ok(response);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.code, "database_schema_mismatch");
  assert.equal(body.retryable, false);
  assert.match(body.error, /storage schema is unavailable/i);
  assert.equal(body.stored, undefined);
  assert.doesNotMatch(JSON.stringify(body), /secret-password|Failed query|relation "decisions"/);
});

test("connection outage is distinguished from missing schema and configuration", async () => {
  const response = workspaceStorageErrorResponse({ cause: { code: "ECONNREFUSED" } });
  assert.ok(response);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "database_unreachable");
  assert.equal(body.retryable, true);
  assert.equal(workspaceStorageErrorResponse(new Error("Unrelated error")), null);
});