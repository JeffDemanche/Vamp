import { rmSync } from "node:fs";
import type { Express } from "express";
import mongoose from "mongoose";
import { config } from "../config";

/**
 * Test-only routes mounted when `E2E=1`. Not available in production or normal
 * development — the env flag must be set explicitly by the Playwright stack.
 */
export function mountE2eRoutes(app: Express): void {
  if (process.env.E2E !== "1") return;

  app.post("/__e2e__/reset", async (_req, res) => {
    const db = mongoose.connection.db;
    if (!db) {
      res.status(503).json({ error: "database not connected" });
      return;
    }

    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));

    if (config.audio.driver === "local") {
      rmSync(config.audio.localDir, { recursive: true, force: true });
    }

    res.json({ ok: true });
  });
}
