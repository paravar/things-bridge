import { join } from "path";
import { existsSync, readdirSync } from "fs";

// ─── Things 3 Database Path ───

/**
 * Auto-detect the Things 3 database path.
 * The path varies depending on Things version — newer installs have a
 * `ThingsData-XXXX/` subdirectory inside the group container.
 */
function findThingsDbPath(): string {
  const home = process.env.HOME ?? "~";
  const groupContainer = join(
    home,
    "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac"
  );

  // Path 1: Direct (older installs)
  const directPath = join(
    groupContainer,
    "Things Database.thingsdatabase/main.sqlite"
  );
  if (existsSync(directPath)) return directPath;

  // Path 2: Inside ThingsData-XXXX/ subdirectory (newer installs)
  if (existsSync(groupContainer)) {
    try {
      const entries = readdirSync(groupContainer);
      for (const entry of entries) {
        if (entry.startsWith("ThingsData-")) {
          const subPath = join(
            groupContainer,
            entry,
            "Things Database.thingsdatabase/main.sqlite"
          );
          if (existsSync(subPath)) return subPath;
        }
      }
    } catch {
      // Permission denied or other error — fall through
    }
  }

  // Fallback to direct path (will fail later with a clear error)
  return directPath;
}

const DEFAULT_DB_PATH = findThingsDbPath();

export const config = {
  port: Number(process.env.THINGS_BRIDGE_PORT ?? 18790),
  host: process.env.THINGS_BRIDGE_HOST ?? "0.0.0.0",
  token: process.env.THINGS_BRIDGE_TOKEN ?? "",
  dbPath: process.env.THINGS_DB_PATH ?? DEFAULT_DB_PATH,
} as const;

export function validateConfig(): string[] {
  const errors: string[] = [];

  if (!config.token) {
    errors.push(
      "THINGS_BRIDGE_TOKEN is not set. Generate one with: openssl rand -base64 32"
    );
  }

  if (!existsSync(config.dbPath)) {
    errors.push(
      `Things 3 database not found at: ${config.dbPath}\n` +
        "  Is Things 3 installed? Set THINGS_DB_PATH to override."
    );
  }

  return errors;
}
