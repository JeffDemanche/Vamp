import { createReadStream } from "node:fs";
import path from "node:path";
import cors from "cors";
import type { Express } from "express";
import { config } from "../config";
import { createServices } from "../container";
import { AUDIO_DOWNLOAD_PATH, AUDIO_UPLOAD_PATH } from "../lib/audioPaths";

/** Matches `GET /audio/blob/<key>` where the key may contain slashes. */
const DOWNLOAD_ROUTE = new RegExp(`^${AUDIO_DOWNLOAD_PATH}/(.+)$`);

function decodeKey(raw: string): string {
  return raw.split("/").map(decodeURIComponent).join("/");
}

/**
 * Mounts the server-owned audio transfer endpoints (the binary data plane that
 * deliberately sits outside GraphQL):
 *
 *  - `PUT /audio/upload/:audioId` — the client streams an audio's bytes here;
 *    the request body is forwarded to the configured `AudioStorage` backend.
 *  - `GET /audio/blob/<key>` — the local driver serves stored bytes back
 *    (Vercel Blob serves its own public URLs, so this 404s under that driver).
 *
 * TODO(audio-upload-auth): the upload endpoint is currently unauthenticated and
 * only bounded by the unguessable audio id; add a signed upload token (or
 * session check) before exposing this publicly.
 */
export function mountAudioRoutes(app: Express): void {
  const corsMw = cors<cors.CorsRequest>({ origin: true, credentials: true });
  const uploadRoute = `${AUDIO_UPLOAD_PATH}/:audioId`;

  app.options(uploadRoute, corsMw);
  app.put(uploadRoute, corsMw, (req, res) => {
    const services = createServices();
    const contentType = req.headers["content-type"] ?? "application/octet-stream";
    void services.projectAudios
      .storeBytes(req.params.audioId, req, contentType)
      .then(() => res.status(204).end())
      .catch((error: unknown) => {
        res.status(404).json({ error: (error as Error).message });
      });
  });

  app.get(DOWNLOAD_ROUTE, corsMw, (req, res) => {
    if (config.audio.driver !== "local") {
      res.status(404).end();
      return;
    }
    const key = decodeKey(req.params[0] ?? "");
    const services = createServices();
    void services.projectAudios
      .findByKey(key)
      .then((audio) => {
        if (!audio) {
          res.status(404).end();
          return;
        }
        res.setHeader("Content-Type", audio.contentType);
        createReadStream(path.join(config.audio.localDir, key))
          .on("error", () => {
            if (!res.headersSent) res.status(404).end();
          })
          .pipe(res);
      })
      .catch(() => res.status(500).end());
  });
}
