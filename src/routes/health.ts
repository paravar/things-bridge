import { config } from "../config";
import { existsSync } from "fs";

export function handleHealth(): Response {
  const dbExists = existsSync(config.dbPath);

  return Response.json({
    ok: true,
    service: "things-bridge",
    version: "0.1.0",
    database: dbExists ? "connected" : "not found",
    timestamp: new Date().toISOString(),
  });
}

export function handleCapabilities(): Response {
  return Response.json({
    ok: true,
    data: {
      capabilities: [
        {
          name: "things-todos",
          description: "Read, create, update, complete, and delete Things 3 to-dos",
          operations: ["read", "create", "update", "complete", "cancel", "delete"],
        },
        {
          name: "things-projects",
          description: "Read, create, and complete Things 3 projects",
          operations: ["read", "create", "complete"],
        },
        {
          name: "things-areas",
          description: "Read Things 3 areas",
          operations: ["read"],
        },
        {
          name: "things-tags",
          description: "Read Things 3 tags and filter to-dos by tag",
          operations: ["read"],
        },
      ],
    },
  });
}
