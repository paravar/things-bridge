---
name: things-bridge
description: Manage Things 3 tasks on the Mac via the Things Bridge HTTP API. Use when a user asks about their to-do list, tasks, projects, or anything related to Things 3. All operations go through HTTP calls to the bridge server — no local CLI or macOS required.
metadata:
  {
    "openclaw":
      {
        "emoji": "📋",
        "requires": { "env": ["THINGS_BRIDGE_URL", "THINGS_BRIDGE_TOKEN"] },
      },
  }
---

# Things Bridge

Manage Things 3 tasks on the Mac via the Things Bridge HTTP API. Read, create, update, complete, and delete to-dos and projects.

**Important:** All operations use `curl` to call the Things Bridge HTTP server on the Mac. Do NOT attempt to run any local CLI tools — use the HTTP endpoints below with `$THINGS_BRIDGE_URL` and `$THINGS_BRIDGE_TOKEN`.

## Configuration

- `THINGS_BRIDGE_URL` — The URL of the Things Bridge server (e.g., `http://192.168.1.159:18790`)
- `THINGS_BRIDGE_TOKEN` — The API bearer token for authentication

## Tools

### list-todos

List to-dos from a Things 3 built-in list.

**Parameters:**
- `list` (optional, default: "today") — One of: inbox, today, upcoming, anytime, someday, logbook

**Example:** "What are my tasks for today?" → `list-todos` with `list=today`

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos?list=today"
```

### search-todos

Search to-dos by title or notes.

**Parameters:**
- `query` (required) — Search text

**Example:** "Find tasks about groceries" → `search-todos` with `query=groceries`

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos/search?q=groceries"
```

### get-todo

Get a specific to-do by UUID.

**Parameters:**
- `uuid` (required) — The UUID of the to-do

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos/{uuid}"
```

### create-todo

Create a new to-do in Things 3.

**Parameters:**
- `title` (required) — The title of the to-do
- `notes` (optional) — Notes for the to-do
- `when` (optional) — When to schedule: today, tomorrow, evening, anytime, someday, or a date (YYYY-MM-DD)
- `deadline` (optional) — Deadline date (YYYY-MM-DD)
- `tags` (optional) — Array of tag names
- `list` (optional) — Project or area name to add to
- `checklist` (optional) — Array of checklist item titles

**Example:** "Add a task to buy milk for today" → `create-todo` with `title=Buy milk, when=today`

```bash
curl -X POST -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","when":"today","tags":["Errands"]}' \
  "$THINGS_BRIDGE_URL/v1/todos"
```

### update-todo

Update an existing to-do.

**Parameters:**
- `uuid` (required) — The UUID of the to-do
- `title` (optional) — New title
- `notes` (optional) — New notes
- `when` (optional) — New schedule
- `deadline` (optional) — New deadline
- `tags` (optional) — Replace tags

```bash
curl -X PATCH -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy organic milk","deadline":"2026-02-10"}' \
  "$THINGS_BRIDGE_URL/v1/todos/{uuid}"
```

### complete-todo

Mark a to-do as complete.

**Parameters:**
- `uuid` (required) — The UUID of the to-do

**Example:** "Mark the milk task as done" → find the UUID first via search, then `complete-todo`

```bash
curl -X POST -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos/{uuid}/complete"
```

### cancel-todo

Cancel a to-do.

**Parameters:**
- `uuid` (required) — The UUID of the to-do

```bash
curl -X POST -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos/{uuid}/cancel"
```

### delete-todo

Delete (trash) a to-do.

**Parameters:**
- `uuid` (required) — The UUID of the to-do

```bash
curl -X DELETE -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/todos/{uuid}"
```

### list-projects

List all active projects.

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/projects"
```

### get-project

Get a project with its to-dos.

**Parameters:**
- `uuid` (required) — The UUID of the project

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/projects/{uuid}"
```

### create-project

Create a new project.

**Parameters:**
- `title` (required) — Project title
- `notes` (optional) — Project notes
- `area` (optional) — Area to add the project to
- `todos` (optional) — Array of to-do titles to create inside the project

```bash
curl -X POST -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Vacation Planning","area":"Personal","todos":["Book flights","Reserve hotel"]}' \
  "$THINGS_BRIDGE_URL/v1/projects"
```

### complete-project

Mark a project as complete.

**Parameters:**
- `uuid` (required) — The UUID of the project

```bash
curl -X POST -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/projects/{uuid}/complete"
```

### list-tags

List all tags.

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/tags"
```

### list-areas

List all areas.

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/areas"
```

### get-todos-by-tag

Get to-dos with a specific tag.

**Parameters:**
- `tag` (required) — Tag name

```bash
curl -H "Authorization: Bearer $THINGS_BRIDGE_TOKEN" \
  "$THINGS_BRIDGE_URL/v1/tags/{tagName}/todos"
```
