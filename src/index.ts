import { config, validateConfig } from "./config";
import { closeDb } from "./db/connection";
import { requireAuth } from "./middleware/auth";
import { handleHealth, handleCapabilities } from "./routes/health";
import {
  handleGetTodos,
  handleGetTodo,
  handleCreateTodo,
  handleUpdateTodo,
  handleCompleteTodo,
  handleCancelTodo,
  handleDeleteTodo,
} from "./routes/todos";
import {
  handleGetProjects,
  handleGetProject,
  handleCreateProject,
  handleCompleteProject,
} from "./routes/projects";
import { handleGetTags, handleGetAreas, handleGetTodosByTag } from "./routes/tags";

// ─── Startup Validation ───

const errors = validateConfig();
if (errors.length > 0) {
  console.error("❌ Configuration errors:");
  for (const error of errors) {
    console.error(`   • ${error}`);
  }
  process.exit(1);
}

// ─── URL Pattern Helpers ───

function matchRoute(
  pathname: string,
  pattern: string
): Record<string, string> | null {
  // Simple pattern matching: "/v1/todos/:uuid" matches "/v1/todos/abc123"
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

// ─── Request Router ───

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // Auth check (skips /health)
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    // ─── Health & Discovery ───
    if (pathname === "/health" && method === "GET") {
      return handleHealth();
    }
    if (pathname === "/v1/capabilities" && method === "GET") {
      return handleCapabilities();
    }

    // ─── To-Dos ───
    if (pathname === "/v1/todos/search" && method === "GET") {
      return handleGetTodos(url);
    }
    if (pathname === "/v1/todos" && method === "GET") {
      return handleGetTodos(url);
    }
    if (pathname === "/v1/todos" && method === "POST") {
      return await handleCreateTodo(request);
    }

    // To-do with UUID
    let params = matchRoute(pathname, "/v1/todos/:uuid/complete");
    if (params && method === "POST") {
      return await handleCompleteTodo(params.uuid);
    }

    params = matchRoute(pathname, "/v1/todos/:uuid/cancel");
    if (params && method === "POST") {
      return await handleCancelTodo(params.uuid);
    }

    params = matchRoute(pathname, "/v1/todos/:uuid");
    if (params) {
      if (method === "GET") return handleGetTodo(params.uuid);
      if (method === "PATCH") return await handleUpdateTodo(params.uuid, request);
      if (method === "DELETE") return await handleDeleteTodo(params.uuid);
    }

    // ─── Projects ───
    if (pathname === "/v1/projects" && method === "GET") {
      return handleGetProjects();
    }
    if (pathname === "/v1/projects" && method === "POST") {
      return await handleCreateProject(request);
    }

    params = matchRoute(pathname, "/v1/projects/:uuid/complete");
    if (params && method === "POST") {
      return await handleCompleteProject(params.uuid);
    }

    params = matchRoute(pathname, "/v1/projects/:uuid");
    if (params && method === "GET") {
      return handleGetProject(params.uuid);
    }

    // ─── Tags & Areas ───
    if (pathname === "/v1/tags" && method === "GET") {
      return handleGetTags();
    }
    if (pathname === "/v1/areas" && method === "GET") {
      return handleGetAreas();
    }

    params = matchRoute(pathname, "/v1/tags/:name/todos");
    if (params && method === "GET") {
      return handleGetTodosByTag(params.name);
    }

    // ─── 404 ───
    return Response.json(
      { ok: false, error: `Not found: ${method} ${pathname}` },
      { status: 404 }
    );
  } catch (err) {
    console.error(`[ERROR] ${method} ${pathname}:`, err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// ─── Start Server ───

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: handleRequest,
});

console.log(`
┌─────────────────────────────────────────────┐
│  Things Bridge v0.1.0                       │
│  Listening on ${config.host}:${config.port}${" ".repeat(Math.max(0, 25 - `${config.host}:${config.port}`.length))}│
│  Database: ${config.dbPath ? "connected" : "missing"}${" ".repeat(Math.max(0, 32 - (config.dbPath ? "connected" : "missing").length))}│
└─────────────────────────────────────────────┘
`);

// ─── Graceful Shutdown ───

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  closeDb();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  server.stop();
  process.exit(0);
});
