import { getDb } from "./connection";
import type {
  Todo,
  ChecklistItem,
  Project,
  Area,
  Tag,
  ThingsList,
} from "../types";

// ─── Constants ───

/** Task status values in TMTask */
const STATUS = { INCOMPLETE: 0, CANCELED: 2, COMPLETED: 3 } as const;

/** Task type values in TMTask */
const TYPE = { TODO: 0, PROJECT: 1, HEADING: 2 } as const;

/** Start bucket values in TMTask */
const START_BUCKET = { ANYTIME: 0, SOMEDAY: 1 } as const;

/**
 * Epoch offset for startDate/deadline fields.
 * These fields use a database-specific epoch (not Unix or Cocoa).
 * We calibrate dynamically at first query by comparing a "today" task's
 * startDate to today's actual date. Fallback: 1637712000 (Nov 24, 2021 UTC).
 */
let startDateEpochOffset: number | null = null;

// ─── Helpers ───

function statusToString(
  status: number
): "incomplete" | "completed" | "canceled" {
  switch (status) {
    case STATUS.COMPLETED:
      return "completed";
    case STATUS.CANCELED:
      return "canceled";
    default:
      return "incomplete";
  }
}

function typeToString(type: number): "to-do" | "project" | "heading" {
  switch (type) {
    case TYPE.PROJECT:
      return "project";
    case TYPE.HEADING:
      return "heading";
    default:
      return "to-do";
  }
}

function startToString(
  start: number | null,
  startBucket: number | null,
  startDate: number | null
): "Inbox" | "Anytime" | "Someday" | null {
  if (start === 2) return "Someday";
  if (start === 1 && startDate !== null) return "Anytime";
  if (startBucket === START_BUCKET.SOMEDAY) return "Someday";
  if (start === 0 && startDate === null) return "Inbox";
  return "Anytime";
}

/**
 * Convert Unix epoch timestamp (seconds since 1970-01-01) to ISO 8601 string.
 * Things 3 stores creationDate, userModificationDate, and stopDate as Unix epoch.
 */
function unixToISO(timestamp: number | null): string | null {
  if (timestamp === null || timestamp === undefined) return null;
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Calibrate the startDate epoch offset by examining a "today" task.
 * startDate uses a database-specific epoch. We detect it dynamically.
 */
function calibrateStartDateEpoch(): number {
  if (startDateEpochOffset !== null) return startDateEpochOffset;

  const db = getDb();
  const row = db
    .query<{ startDate: number }, []>(
      `SELECT startDate FROM TMTask
       WHERE start = 1 AND startDate IS NOT NULL AND status = 0 AND trashed = 0
       ORDER BY startDate DESC LIMIT 1`
    )
    .get();

  if (row) {
    // The most recent startDate should correspond to today (or very recent)
    const todayMidnightUnix =
      Math.floor(Date.now() / 86400000) * 86400; // today midnight UTC
    const taskDay = Math.floor(row.startDate / 86400);
    startDateEpochOffset = todayMidnightUnix - taskDay * 86400;
  } else {
    // Fallback offset (known to work for this database)
    startDateEpochOffset = 1637712000;
  }

  return startDateEpochOffset;
}

/**
 * Convert Things startDate/deadline field to YYYY-MM-DD string.
 * These use a database-specific epoch that we calibrate dynamically.
 */
function thingsScheduleDateToString(
  dateValue: number | null
): string | null {
  if (dateValue === null || dateValue === undefined) return null;
  const offset = calibrateStartDateEpoch();
  const unixTimestamp = dateValue + offset;
  return new Date(unixTimestamp * 1000).toISOString().split("T")[0];
}

/** Get tags for a given task UUID */
function getTagsForTask(taskUuid: string): string[] {
  const db = getDb();
  const rows = db
    .query<{ title: string }, [string]>(
      `SELECT t.title
       FROM TMTag t
       JOIN TMTaskTag tt ON tt.tags = t.uuid
       WHERE tt.tasks = ?`
    )
    .all(taskUuid);
  return rows.map((r) => r.title);
}

/** Get checklist items for a given task UUID */
function getChecklistForTask(taskUuid: string): ChecklistItem[] {
  const db = getDb();
  const rows = db
    .query<
      { uuid: string; title: string; status: number },
      [string]
    >(
      `SELECT uuid, title, status
       FROM TMChecklistItem
       WHERE task = ?
       ORDER BY "index" ASC`
    )
    .all(taskUuid);
  return rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    status: statusToString(r.status),
  }));
}

// ─── Raw row type from SQLite ───

interface RawTaskRow {
  uuid: string;
  title: string;
  type: number;
  status: number;
  start: number | null;
  notes: string | null;
  startDate: number | null;
  startBucket: number | null;
  deadline: number | null;
  creationDate: number | null;
  userModificationDate: number | null;
  stopDate: number | null;
  project: string | null;
  projectTitle: string | null;
  area: string | null;
  areaTitle: string | null;
  reminderTime: number | null;
}

function rowToTodo(row: RawTaskRow): Todo {
  return {
    uuid: row.uuid,
    title: row.title ?? "",
    type: typeToString(row.type),
    status: statusToString(row.status),
    notes: row.notes ?? "",
    start: startToString(row.start, row.startBucket, row.startDate),
    startDate: thingsScheduleDateToString(row.startDate),
    deadline: thingsScheduleDateToString(row.deadline),
    createdAt: unixToISO(row.creationDate) ?? "",
    modifiedAt: unixToISO(row.userModificationDate) ?? "",
    completedAt: unixToISO(row.stopDate),
    project: row.project,
    projectTitle: row.projectTitle,
    area: row.area,
    areaTitle: row.areaTitle,
    tags: getTagsForTask(row.uuid),
    checklist: getChecklistForTask(row.uuid),
    reminderTime: unixToISO(row.reminderTime),
  };
}

// ─── Base query for tasks ───

const BASE_TASK_SELECT = `
  SELECT
    t.uuid,
    t.title,
    t.type,
    t.status,
    t.start,
    t.notes,
    t.startDate,
    t.startBucket,
    t.deadline,
    t.creationDate,
    t.userModificationDate,
    t.stopDate,
    t.project,
    p.title AS projectTitle,
    COALESCE(t.area, p.area) AS area,
    a.title AS areaTitle,
    t.reminderTime
  FROM TMTask t
  LEFT JOIN TMTask p ON t.project = p.uuid
  LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
`;

// ─── Public Query Functions ───

/** Get to-dos from a specific built-in list */
export function getTodosByList(list: ThingsList): Todo[] {
  const db = getDb();
  let where: string;

  switch (list) {
    case "inbox":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status = ${STATUS.INCOMPLETE}
          AND t.trashed = 0
          AND t.start = 0
          AND t.startDate IS NULL
          AND t.startBucket = 0
          AND t.project IS NULL
          AND t.heading IS NULL
      `;
      break;

    case "today":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status = ${STATUS.INCOMPLETE}
          AND t.trashed = 0
          AND t.start = 1
          AND t.startDate IS NOT NULL
        ORDER BY t.todayIndex ASC
      `;
      break;

    case "upcoming":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status = ${STATUS.INCOMPLETE}
          AND t.trashed = 0
          AND t.start = 1
          AND t.startDate IS NOT NULL
          AND t.startBucket = 0
        ORDER BY t.startDate ASC
      `;
      break;

    case "anytime":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status = ${STATUS.INCOMPLETE}
          AND t.trashed = 0
          AND t.start = 1
          AND t.startBucket = ${START_BUCKET.ANYTIME}
        ORDER BY t.todayIndex ASC
      `;
      break;

    case "someday":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status = ${STATUS.INCOMPLETE}
          AND t.trashed = 0
          AND t.start = 2
        ORDER BY t.creationDate DESC
      `;
      break;

    case "logbook":
      where = `
        WHERE t.type = ${TYPE.TODO}
          AND t.status IN (${STATUS.COMPLETED}, ${STATUS.CANCELED})
          AND t.trashed = 0
        ORDER BY t.stopDate DESC
        LIMIT 50
      `;
      break;

    default:
      where = `WHERE 1 = 0`;
  }

  const rows = db.query<RawTaskRow, []>(`${BASE_TASK_SELECT} ${where}`).all();
  return rows.map(rowToTodo);
}

/** Get a single to-do by UUID */
export function getTodoByUuid(uuid: string): Todo | null {
  const db = getDb();
  const row = db
    .query<RawTaskRow, [string]>(
      `${BASE_TASK_SELECT}
       WHERE t.uuid = ? AND t.type = ${TYPE.TODO}`
    )
    .get(uuid);
  return row ? rowToTodo(row) : null;
}

/** Search to-dos by title or notes */
export function searchTodos(query: string): Todo[] {
  const db = getDb();
  const pattern = `%${query}%`;
  const rows = db
    .query<RawTaskRow, [string, string]>(
      `${BASE_TASK_SELECT}
       WHERE t.type = ${TYPE.TODO}
         AND t.trashed = 0
         AND (t.title LIKE ? OR t.notes LIKE ?)
       ORDER BY t.userModificationDate DESC
       LIMIT 50`
    )
    .all(pattern, pattern);
  return rows.map(rowToTodo);
}

/** Get all projects */
export function getProjects(): Project[] {
  const db = getDb();
  const rows = db
    .query<
      RawTaskRow & { todoCount: number },
      []
    >(
      `SELECT
        t.uuid, t.title, t.type, t.status, t.start, t.notes,
        t.startDate, t.startBucket, t.deadline,
        t.creationDate, t.userModificationDate, t.stopDate,
        NULL AS project, NULL AS projectTitle,
        t.area, a.title AS areaTitle,
        t.reminderTime,
        (SELECT COUNT(*) FROM TMTask sub
         WHERE sub.project = t.uuid AND sub.type = ${TYPE.TODO} AND sub.trashed = 0) AS todoCount
       FROM TMTask t
       LEFT JOIN TMArea a ON t.area = a.uuid
       WHERE t.type = ${TYPE.PROJECT}
         AND t.trashed = 0
         AND t.status = ${STATUS.INCOMPLETE}
       ORDER BY t.title ASC`
    )
    .all();

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title ?? "",
    status: statusToString(row.status),
    notes: row.notes ?? "",
    start: startToString(row.start, row.startBucket, row.startDate),
    startDate: thingsScheduleDateToString(row.startDate),
    deadline: thingsScheduleDateToString(row.deadline),
    createdAt: unixToISO(row.creationDate) ?? "",
    modifiedAt: unixToISO(row.userModificationDate) ?? "",
    completedAt: unixToISO(row.stopDate),
    area: row.area,
    areaTitle: row.areaTitle,
    tags: getTagsForTask(row.uuid),
    todoCount: row.todoCount,
  }));
}

/** Get a single project by UUID with its to-dos */
export function getProjectByUuid(
  uuid: string
): (Project & { todos: Todo[] }) | null {
  const db = getDb();
  const row = db
    .query<
      RawTaskRow & { todoCount: number },
      [string]
    >(
      `SELECT
        t.uuid, t.title, t.type, t.status, t.start, t.notes,
        t.startDate, t.startBucket, t.deadline,
        t.creationDate, t.userModificationDate, t.stopDate,
        NULL AS project, NULL AS projectTitle,
        t.area, a.title AS areaTitle,
        t.reminderTime,
        (SELECT COUNT(*) FROM TMTask sub
         WHERE sub.project = t.uuid AND sub.type = ${TYPE.TODO} AND sub.trashed = 0) AS todoCount
       FROM TMTask t
       LEFT JOIN TMArea a ON t.area = a.uuid
       WHERE t.uuid = ? AND t.type = ${TYPE.PROJECT}`
    )
    .get(uuid);

  if (!row) return null;

  // Get todos in this project
  const todoRows = db
    .query<RawTaskRow, [string]>(
      `${BASE_TASK_SELECT}
       WHERE t.project = ? AND t.type = ${TYPE.TODO} AND t.trashed = 0
       ORDER BY t."index" ASC`
    )
    .all(uuid);

  return {
    uuid: row.uuid,
    title: row.title ?? "",
    status: statusToString(row.status),
    notes: row.notes ?? "",
    start: startToString(row.start, row.startBucket, row.startDate),
    startDate: thingsScheduleDateToString(row.startDate),
    deadline: thingsScheduleDateToString(row.deadline),
    createdAt: unixToISO(row.creationDate) ?? "",
    modifiedAt: unixToISO(row.userModificationDate) ?? "",
    completedAt: unixToISO(row.stopDate),
    area: row.area,
    areaTitle: row.areaTitle,
    tags: getTagsForTask(row.uuid),
    todoCount: row.todoCount,
    todos: todoRows.map(rowToTodo),
  };
}

/** Get all areas */
export function getAreas(): Area[] {
  const db = getDb();
  return db
    .query<{ uuid: string; title: string }, []>(
      `SELECT uuid, title FROM TMArea ORDER BY title ASC`
    )
    .all();
}

/** Get all tags */
export function getTags(): Tag[] {
  const db = getDb();
  return db
    .query<Tag, []>(
      `SELECT uuid, title, shortcut FROM TMTag ORDER BY title ASC`
    )
    .all();
}

/** Get to-dos with a specific tag */
export function getTodosByTag(tagName: string): Todo[] {
  const db = getDb();
  const rows = db
    .query<RawTaskRow, [string]>(
      `${BASE_TASK_SELECT}
       JOIN TMTaskTag tt ON tt.tasks = t.uuid
       JOIN TMTag tag ON tt.tags = tag.uuid
       WHERE tag.title = ?
         AND t.type = ${TYPE.TODO}
         AND t.trashed = 0
         AND t.status = ${STATUS.INCOMPLETE}
       ORDER BY t.userModificationDate DESC`
    )
    .all(tagName);
  return rows.map(rowToTodo);
}
