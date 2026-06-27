import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { AudioStorageConfig } from "../src/config";
import {
  createAudioStorage,
  LocalAudioStorage,
  VercelBlobAudioStorage,
} from "../src/lib/audioStorage";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vamp-audio-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function localStorage(): LocalAudioStorage {
  return new LocalAudioStorage({ localDir: dir, publicBaseUrl: "http://localhost:4000" });
}

describe("LocalAudioStorage (local dev driver)", () => {
  const key = "projects/p1/audio/a1";

  it("writes bytes to disk and reports their size via head", async () => {
    const storage = localStorage();
    const bytes = Buffer.from("fake audio payload");

    await storage.write(key, Readable.from(bytes), "audio/wav");

    const info = await storage.head(key);
    expect(info).toEqual({ contentLength: bytes.length });
  });

  it("returns null from head for an object that was never written", async () => {
    await expect(localStorage().head("projects/p1/audio/missing")).resolves.toBeNull();
  });

  it("builds a download URL under the server's public base, keeping key segments", async () => {
    const url = await localStorage().createDownloadUrl(key);
    expect(url).toBe(`http://localhost:4000/audio/blob/${key}`);
  });
});

describe("createAudioStorage (driver selection)", () => {
  const base: AudioStorageConfig = {
    driver: "local",
    publicBaseUrl: "http://localhost:4000",
    localDir: "/tmp/whatever",
  };

  it("returns the local driver when driver is 'local'", () => {
    expect(createAudioStorage(base)).toBeInstanceOf(LocalAudioStorage);
  });

  it("returns the Vercel Blob driver when driver is 'vercel'", () => {
    expect(createAudioStorage({ ...base, driver: "vercel" })).toBeInstanceOf(
      VercelBlobAudioStorage,
    );
  });
});
