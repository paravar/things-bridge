# Things Bridge

HTTP bridge that connects [OpenClaw](https://openclaw.ai) (or any HTTP client) to [Things 3](https://culturedcode.com/things/) on macOS. Reads from the Things SQLite database and writes via AppleScript — no UI popups, no auth tokens, fully headless.

## Why

Things 3 has no official API. This bridge exposes a REST API so an AI agent running on a different machine (e.g., a Raspberry Pi) can read and manage your tasks over the LAN.

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Any HTTP Client         │         │  Mac                         │
│  (OpenClaw, curl, etc.)  │  HTTP   │  Things Bridge (Bun + TS)   │
│                          │◄───────►│  Reads: bun:sqlite (readonly)│
│                          │  LAN    │  Writes: AppleScript         │
│                          │         │  Things 3 App                │
└──────────────────────────┘         └──────────────────────────────┘
```

- **Reads** go through `bun:sqlite` in readonly mode — fast, zero dependencies, safe
- **Writes** go through AppleScript via `osascript` — headless, full CRUD, no auth token needed

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | [Bun](https://bun.sh) | Built-in SQLite, built-in HTTP server, TypeScript-first |
| Language | TypeScript | Type safety, matches OpenClaw ecosystem |
| Read layer | `bun:sqlite` | Zero deps, native speed, readonly mode |
| Write layer | `osascript` | Headless AppleScript, full CRUD |
| Auth | Bearer token | Simple, one env var |
| Process mgmt | launchd | macOS native, auto-start on login |

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and set THINGS_BRIDGE_TOKEN (generate with: openssl rand -base64 32)
```

### 3. Grant Full Disk Access to Bun

Things 3 stores its database in a sandboxed container. Bun needs Full Disk Access to read it:

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Click **+** and add your Bun binary (find it with `which bun`)

### 4. Run

```bash
bun run dev    # Watch mode (restarts on file changes)
bun run start  # Single run
bun run check  # TypeScript type check
```

### 5. Test

```bash
# Health check (no auth)
curl http://localhost:18790/health

# Get today's tasks
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:18790/v1/todos?list=today"

# Create a task
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","when":"today"}' \
  http://localhost:18790/v1/todos
```

## API Reference

All endpoints except `/health` and `/v1/capabilities` require `Authorization: Bearer <token>`.

### Health & Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — service status, version, DB connectivity |
| GET | `/v1/capabilities` | List available operations |

### To-Dos

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/todos?list=today` | List to-dos. Lists: `inbox`, `today`, `upcoming`, `anytime`, `someday`, `logbook` |
| GET | `/v1/todos/:uuid` | Get a specific to-do |
| GET | `/v1/todos/search?q=...` | Search by title/notes |
| POST | `/v1/todos` | Create a to-do |
| PATCH | `/v1/todos/:uuid` | Update a to-do |
| POST | `/v1/todos/:uuid/complete` | Complete a to-do |
| POST | `/v1/todos/:uuid/cancel` | Cancel a to-do |
| DELETE | `/v1/todos/:uuid` | Trash a to-do |

#### Create to-do body

```json
{
  "title": "Buy milk",
  "notes": "2% organic",
  "when": "today",
  "deadline": "2026-02-10",
  "tags": ["Errands"],
  "list": "Shopping",
  "checklist": ["Milk", "Eggs", "Bread"]
}
```

`when` accepts: `today`, `tomorrow`, `evening`, `anytime`, `someday`, or a date string (`YYYY-MM-DD`).

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/projects` | List all active projects (with to-do counts) |
| GET | `/v1/projects/:uuid` | Get project with child to-dos |
| POST | `/v1/projects` | Create a project |
| POST | `/v1/projects/:uuid/complete` | Complete a project |

### Tags & Areas

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/areas` | List all areas |
| GET | `/v1/tags` | List all tags |
| GET | `/v1/tags/:name/todos` | Get to-dos by tag |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `THINGS_BRIDGE_PORT` | `18790` | HTTP server port |
| `THINGS_BRIDGE_HOST` | `0.0.0.0` | Bind address |
| `THINGS_BRIDGE_TOKEN` | _(required)_ | API bearer token |
| `THINGS_DB_PATH` | _(auto-detected)_ | Override Things SQLite path |

## Running as a Service (launchd)

A launchd plist is included for auto-start on login:

```bash
# Edit the plist to set your token and paths
vim com.openclaw.things-bridge.plist

# Install
cp com.openclaw.things-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.openclaw.things-bridge.plist

# Manage
launchctl list | grep things-bridge
launchctl stop com.openclaw.things-bridge
launchctl start com.openclaw.things-bridge
```

## OpenClaw Skill

The `skill/SKILL.md` file is an [OpenClaw](https://openclaw.ai) skill definition. To use with OpenClaw:

1. Copy the skill to your OpenClaw instance:
   ```bash
   cp -r skill/ ~/.openclaw/skills/things-bridge/
   ```

2. Add to your `~/.openclaw/openclaw.json`:
   ```json
   {
     "skills": {
       "entries": {
         "things-bridge": {
           "enabled": true,
           "env": {
             "THINGS_BRIDGE_URL": "http://<mac-ip>:18790",
             "THINGS_BRIDGE_TOKEN": "<your-token>"
           }
         }
       }
     }
   }
   ```

3. Restart OpenClaw and ask: "What's on my to-do list today?"

## Limitations

- **Repeating/recurring todos** — Read support is available: recurring tasks appear in lists with `repeating: true` and the raw `recurrenceRule`. Creating or modifying repeating tasks is not possible — you must manage recurrence rules in the Things UI.
- **No native checklist items** — Checklist items are appended to notes as bullet points (AppleScript limitation).
- **No reminders** — Can read `reminderTime` but can't set reminders.
- **No headings** — Can't create or manage section headings within projects.
- **macOS only** — Requires Things 3 running on macOS.

## Date Epoch Gotchas

Things 3 uses **two different timestamp formats** in the same database:

| Columns | Epoch | Conversion |
|---------|-------|------------|
| `creationDate`, `userModificationDate`, `stopDate` | Unix (1970) | `new Date(value * 1000)` |
| `startDate`, `deadline` | Database-specific | Requires dynamic calibration at startup |

Many existing tools incorrectly document `creationDate` as Cocoa epoch (2001) — this is **wrong** for DB version 26.

## License

MIT
