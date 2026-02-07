import { getProjects, getProjectByUuid } from "../db/queries";
import { createProject, completeProject } from "../applescript/executor";
import type { CreateProjectRequest } from "../types";

/** GET /v1/projects */
export function handleGetProjects(): Response {
  const projects = getProjects();
  return Response.json({ ok: true, data: projects });
}

/** GET /v1/projects/:uuid */
export function handleGetProject(uuid: string): Response {
  const project = getProjectByUuid(uuid);
  if (!project) {
    return Response.json(
      { ok: false, error: "Project not found" },
      { status: 404 }
    );
  }
  return Response.json({ ok: true, data: project });
}

/** POST /v1/projects — Create a new project */
export async function handleCreateProject(request: Request): Promise<Response> {
  let body: CreateProjectRequest;
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
    const name = await createProject(body);
    return Response.json(
      { ok: true, data: { title: name, message: "Project created" } },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

/** POST /v1/projects/:uuid/complete */
export async function handleCompleteProject(uuid: string): Promise<Response> {
  const existing = getProjectByUuid(uuid);
  if (!existing) {
    return Response.json(
      { ok: false, error: "Project not found" },
      { status: 404 }
    );
  }

  try {
    await completeProject(uuid);
    return Response.json({
      ok: true,
      data: { message: `Completed project: ${existing.title}` },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to complete project: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
