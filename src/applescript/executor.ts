import type { CreateTodoRequest, CreateProjectRequest, UpdateTodoRequest } from "../types";

// ─── AppleScript Execution ───

/**
 * Execute an AppleScript string via osascript.
 * Returns stdout on success, throws on error.
 */
async function runAppleScript(script: string): Promise<string> {
  const proc = Bun.spawn(["osascript", "-e", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    throw new Error(`AppleScript failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  return stdout.trim();
}

// ─── Escaping ───

/** Escape a string for use inside AppleScript double quotes */
function escapeAS(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ─── To-Do Operations ───

/** Create a new to-do in Things 3. Returns the name of the created to-do. */
export async function createTodo(req: CreateTodoRequest): Promise<string> {
  const props: string[] = [`name:"${escapeAS(req.title)}"`];

  if (req.notes) {
    props.push(`notes:"${escapeAS(req.notes)}"`);
  }

  if (req.deadline) {
    props.push(`due date:date "${escapeAS(req.deadline)}"`);
  }

  if (req.tags && req.tags.length > 0) {
    props.push(`tag names:"${escapeAS(req.tags.join(", "))}"`);
  }

  // Determine the target list/location
  // Built-in Things lists that can be used as targets
  const builtInLists: Record<string, string> = {
    inbox: "Inbox",
    today: "Today",
    anytime: "Anytime",
    someday: "Someday",
    upcoming: "Upcoming",
  };

  let location = "";
  if (req.when && builtInLists[req.when.toLowerCase()]) {
    location = ` at beginning of list "${builtInLists[req.when.toLowerCase()]}"`;
  } else if (req.list) {
    const listLower = req.list.toLowerCase();
    if (builtInLists[listLower]) {
      // Treat "inbox", "today" etc. as built-in lists, not project names
      location = ` at beginning of list "${builtInLists[listLower]}"`;
    } else {
      // Treat as a project name
      location = ` at beginning of project "${escapeAS(req.list)}"`;
    }
  }
  // No location = defaults to Things Inbox

  const script = `tell application "Things3"
  set newToDo to make new to do with properties {${props.join(", ")}}${location}
  return name of newToDo
end tell`;

  const result = await runAppleScript(script);

  // If a specific date was given (not today/anytime/someday), schedule it
  if (req.when && !["today", "tomorrow", "evening", "anytime", "someday"].includes(req.when)) {
    const scheduleScript = `tell application "Things3"
  set toDo to to do named "${escapeAS(req.title)}"
  schedule toDo for date "${escapeAS(req.when)}"
end tell`;
    await runAppleScript(scheduleScript).catch(() => {
      // Scheduling might fail if the date format is not recognized
    });
  } else if (req.when === "tomorrow") {
    const scheduleScript = `tell application "Things3"
  set toDo to to do named "${escapeAS(req.title)}"
  schedule toDo for (current date) + 1 * days
end tell`;
    await runAppleScript(scheduleScript).catch(() => {});
  }

  // Add checklist items if provided
  if (req.checklist && req.checklist.length > 0) {
    // Checklist items aren't directly supported via make, use URL scheme
    // For now, append them to notes as a workaround
    const checklistText = req.checklist.map((item) => `- ${item}`).join("\\n");
    const notesScript = `tell application "Things3"
  set toDo to to do named "${escapeAS(req.title)}"
  set notes of toDo to (notes of toDo) & "\\n${escapeAS(checklistText)}"
end tell`;
    await runAppleScript(notesScript).catch(() => {});
  }

  return result;
}

/** Complete a to-do by its UUID */
export async function completeTodo(identifier: string): Promise<void> {
  const script = `tell application "Things3"
  set status of to do id "${escapeAS(identifier)}" to completed
end tell`;
  await runAppleScript(script);
}

/** Cancel a to-do */
export async function cancelTodo(identifier: string): Promise<void> {
  const script = `tell application "Things3"
  set status of to do id "${escapeAS(identifier)}" to canceled
end tell`;
  await runAppleScript(script);
}

/** Delete (trash) a to-do */
export async function deleteTodo(identifier: string): Promise<void> {
  // Use move to Trash — works for both incomplete and completed to-dos
  const script = `tell application "Things3"
  move to do id "${escapeAS(identifier)}" to list "Trash"
end tell`;
  await runAppleScript(script);
}

/** Update a to-do's properties */
export async function updateTodo(
  uuid: string,
  req: UpdateTodoRequest
): Promise<void> {
  const commands: string[] = [
    `set toDo to to do id "${escapeAS(uuid)}"`,
  ];

  if (req.title) {
    commands.push(`set name of toDo to "${escapeAS(req.title)}"`);
  }
  if (req.notes !== undefined) {
    commands.push(`set notes of toDo to "${escapeAS(req.notes)}"`);
  }
  if (req.tags) {
    commands.push(
      `set tag names of toDo to "${escapeAS(req.tags.join(", "))}"`
    );
  }
  if (req.deadline) {
    commands.push(`set due date of toDo to date "${escapeAS(req.deadline)}"`);
  }

  const script = `tell application "Things3"
  ${commands.join("\n  ")}
end tell`;
  await runAppleScript(script);

  // Handle when/scheduling
  if (req.when) {
    if (req.when === "today") {
      await moveTodoToList(uuid, "Today");
    } else if (req.when === "someday") {
      await moveTodoToList(uuid, "Someday");
    } else if (req.when === "anytime") {
      await moveTodoToList(uuid, "Anytime");
    }
  }
}

/** Move a to-do to a built-in list */
async function moveTodoToList(uuid: string, list: string): Promise<void> {
  const script = `tell application "Things3"
  move to do id "${escapeAS(uuid)}" to list "${escapeAS(list)}"
end tell`;
  await runAppleScript(script);
}

// ─── Project Operations ───

/** Create a new project */
export async function createProject(req: CreateProjectRequest): Promise<string> {
  const props: string[] = [`name:"${escapeAS(req.title)}"`];

  if (req.notes) {
    props.push(`notes:"${escapeAS(req.notes)}"`);
  }
  if (req.tags && req.tags.length > 0) {
    props.push(`tag names:"${escapeAS(req.tags.join(", "))}"`);
  }

  let location = "";
  if (req.area) {
    location = ` at beginning of area "${escapeAS(req.area)}"`;
  }

  const script = `tell application "Things3"
  set newProject to make new project with properties {${props.join(", ")}}${location}
  return name of newProject
end tell`;

  const result = await runAppleScript(script);

  // Create child to-dos if provided
  if (req.todos && req.todos.length > 0) {
    for (const todoTitle of req.todos) {
      const todoScript = `tell application "Things3"
  make new to do with properties {name:"${escapeAS(todoTitle)}"} at beginning of project "${escapeAS(req.title)}"
end tell`;
      await runAppleScript(todoScript).catch(() => {});
    }
  }

  return result;
}

/** Complete a project */
export async function completeProject(uuid: string): Promise<void> {
  const script = `tell application "Things3"
  set status of project id "${escapeAS(uuid)}" to completed
end tell`;
  await runAppleScript(script);
}
