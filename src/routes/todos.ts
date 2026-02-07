import {
  getTodosByList,
  getTodoByUuid,
  searchTodos,
} from "../db/queries";
import {
  createTodo,
  completeTodo,
  cancelTodo,
  deleteTodo,
  updateTodo,
} from "../applescript/executor";
import type { ThingsList, CreateTodoRequest, UpdateTodoRequest } from "../types";

const VALID_LISTS: ThingsList[] = [
  "inbox",
  "today",
  "upcoming",
  "anytime",
  "someday",
  "logbook",
];

/** GET /v1/todos?list=today or GET /v1/todos/search?q=... */
export function handleGetTodos(url: URL): Response {
  // Search
  const searchQuery = url.searchParams.get("q");
  if (url.pathname.endsWith("/search")) {
    if (!searchQuery) {
      return Response.json(
        { ok: false, error: "Missing query parameter: q" },
        { status: 400 }
      );
    }
    const results = searchTodos(searchQuery);
    return Response.json({ ok: true, data: results });
  }

  // List view
  const list = (url.searchParams.get("list") ?? "today") as ThingsList;
  if (!VALID_LISTS.includes(list)) {
    return Response.json(
      {
        ok: false,
        error: `Invalid list. Valid options: ${VALID_LISTS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const todos = getTodosByList(list);
  return Response.json({ ok: true, data: todos });
}

/** GET /v1/todos/:uuid */
export function handleGetTodo(uuid: string): Response {
  const todo = getTodoByUuid(uuid);
  if (!todo) {
    return Response.json(
      { ok: false, error: "To-do not found" },
      { status: 404 }
    );
  }
  return Response.json({ ok: true, data: todo });
}

/** POST /v1/todos — Create a new to-do */
export async function handleCreateTodo(request: Request): Promise<Response> {
  let body: CreateTodoRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.title) {
    return Response.json(
      { ok: false, error: "Missing required field: title" },
      { status: 400 }
    );
  }

  try {
    const name = await createTodo(body);
    return Response.json(
      { ok: true, data: { title: name, message: "To-do created" } },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to create to-do: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

/** PATCH /v1/todos/:uuid — Update a to-do */
export async function handleUpdateTodo(
  uuid: string,
  request: Request
): Promise<Response> {
  let body: UpdateTodoRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Verify to-do exists
  const existing = getTodoByUuid(uuid);
  if (!existing) {
    return Response.json(
      { ok: false, error: "To-do not found" },
      { status: 404 }
    );
  }

  try {
    await updateTodo(uuid, body);
    return Response.json({ ok: true, data: { message: "To-do updated" } });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to update to-do: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

/** POST /v1/todos/:uuid/complete */
export async function handleCompleteTodo(uuid: string): Promise<Response> {
  const existing = getTodoByUuid(uuid);
  if (!existing) {
    return Response.json(
      { ok: false, error: "To-do not found" },
      { status: 404 }
    );
  }

  try {
    await completeTodo(uuid);
    return Response.json({
      ok: true,
      data: { message: `Completed: ${existing.title}` },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to complete to-do: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

/** POST /v1/todos/:uuid/cancel */
export async function handleCancelTodo(uuid: string): Promise<Response> {
  const existing = getTodoByUuid(uuid);
  if (!existing) {
    return Response.json(
      { ok: false, error: "To-do not found" },
      { status: 404 }
    );
  }

  try {
    await cancelTodo(uuid);
    return Response.json({
      ok: true,
      data: { message: `Canceled: ${existing.title}` },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to cancel to-do: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

/** DELETE /v1/todos/:uuid */
export async function handleDeleteTodo(uuid: string): Promise<Response> {
  const existing = getTodoByUuid(uuid);
  if (!existing) {
    return Response.json(
      { ok: false, error: "To-do not found" },
      { status: 404 }
    );
  }

  try {
    await deleteTodo(uuid);
    return Response.json({
      ok: true,
      data: { message: `Deleted: ${existing.title}` },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to delete to-do: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
