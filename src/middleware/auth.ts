import { config } from "../config";

/**
 * Validate the Authorization header against the configured token.
 * Returns null if valid, or a Response if invalid.
 */
export function requireAuth(request: Request): Response | null {
  // Skip auth for health and capabilities (discovery endpoints)
  const url = new URL(request.url);
  if (url.pathname === "/health" || url.pathname === "/v1/capabilities") {
    return null;
  }

  if (!config.token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server token not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== config.token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid token" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return null; // Auth passed
}
