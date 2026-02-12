// ─── Things 3 Domain Types ───

export interface Todo {
  uuid: string;
  title: string;
  type: "to-do" | "project" | "heading";
  status: "incomplete" | "completed" | "canceled";
  notes: string;
  start: "Inbox" | "Anytime" | "Someday" | null;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  modifiedAt: string;
  completedAt: string | null;
  project: string | null;
  projectTitle: string | null;
  area: string | null;
  areaTitle: string | null;
  tags: string[];
  checklist: ChecklistItem[];
  reminderTime: string | null;
  repeating: boolean;
  recurrenceRule: string | null;
}

export interface ChecklistItem {
  uuid: string;
  title: string;
  status: "incomplete" | "completed" | "canceled";
}

export interface Project {
  uuid: string;
  title: string;
  status: "incomplete" | "completed" | "canceled";
  notes: string;
  start: "Inbox" | "Anytime" | "Someday" | null;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  modifiedAt: string;
  completedAt: string | null;
  area: string | null;
  areaTitle: string | null;
  tags: string[];
  todoCount: number;
}

export interface Area {
  uuid: string;
  title: string;
}

export interface Tag {
  uuid: string;
  title: string;
  shortcut: string | null;
}

// ─── API Request/Response Types ───

export interface CreateTodoRequest {
  title: string;
  notes?: string;
  when?: string; // "today" | "tomorrow" | "evening" | "anytime" | "someday" | date string
  deadline?: string; // YYYY-MM-DD
  tags?: string[];
  list?: string; // project or area title
  checklist?: string[];
}

export interface UpdateTodoRequest {
  title?: string;
  notes?: string;
  when?: string;
  deadline?: string;
  tags?: string[];
}

export interface CreateProjectRequest {
  title: string;
  notes?: string;
  when?: string;
  deadline?: string;
  tags?: string[];
  area?: string;
  todos?: string[]; // titles of to-dos to create inside
}

export type ThingsList =
  | "inbox"
  | "today"
  | "upcoming"
  | "anytime"
  | "someday"
  | "logbook";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
