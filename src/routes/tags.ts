import { getTags, getAreas, getTodosByTag } from "../db/queries";

/** GET /v1/tags */
export function handleGetTags(): Response {
  const tags = getTags();
  return Response.json({ ok: true, data: tags });
}

/** GET /v1/areas */
export function handleGetAreas(): Response {
  const areas = getAreas();
  return Response.json({ ok: true, data: areas });
}

/** GET /v1/tags/:name/todos */
export function handleGetTodosByTag(tagName: string): Response {
  const todos = getTodosByTag(decodeURIComponent(tagName));
  return Response.json({ ok: true, data: todos });
}
