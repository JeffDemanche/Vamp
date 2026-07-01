import { AudioEngine } from "./AudioEngine";
import {
  ensureAudioLoaded,
  resetAudioLoaderForTests,
} from "./audioLoader";
import { filterReadyAudios, toAudioEngineClip, collectProjectAudios } from "./clipMapping";

describe("clipMapping", () => {
  const readyAudio = {
    _id: "audio-1",
    uploadStatus: "READY",
    downloadUrl: "https://example.com/audio-1",
  };

  it("maps a READY clip to an AudioEngineClip", () => {
    expect(
      toAudioEngineClip({
        _id: "clip-1",
        start: 100,
        duration: 500,
        audioOffset: 50,
        audio: readyAudio,
        audioInClips: [{ start: 100, duration: 500, audioOffset: 50 }],
      }),
    ).toEqual({
      id: "clip-1",
      audioId: "audio-1",
      start: 100,
      duration: 500,
      audioInClips: [{ start: 100, duration: 500, audioOffset: 50 }],
    });
  });

  it("passes through baked STACKED audioInClips", () => {
    expect(
      toAudioEngineClip({
        _id: "clip-1",
        start: 0,
        duration: 1000,
        audioOffset: 0,
        mode: "STACKED",
        audioInClips: [
          { start: 0, duration: 1000, audioOffset: 0 },
          { start: 0, duration: 1000, audioOffset: 1000 },
        ],
        audio: { ...readyAudio, loopLength: 1000 },
      }),
    ).toEqual({
      id: "clip-1",
      audioId: "audio-1",
      start: 0,
      duration: 1000,
      audioInClips: [
        { start: 0, duration: 1000, audioOffset: 0 },
        { start: 0, duration: 1000, audioOffset: 1000 },
      ],
    });
  });

  it("backfills audioInClips for legacy clips", () => {
    expect(
      toAudioEngineClip({
        _id: "clip-1",
        start: 0,
        duration: 1000,
        audioOffset: 0,
        mode: "STACKED",
        audio: { ...readyAudio, loopLength: 1000, durationSamples: 2000 },
      }),
    ).toEqual({
      id: "clip-1",
      audioId: "audio-1",
      start: 0,
      duration: 1000,
      audioInClips: [
        { start: 0, duration: 1000, audioOffset: 0 },
        { start: 0, duration: 1000, audioOffset: 1000 },
      ],
    });
  });

  it("returns null when audio is PENDING", () => {
    expect(
      toAudioEngineClip({
        _id: "clip-1",
        start: 0,
        duration: 100,
        audioOffset: 0,
        audio: { ...readyAudio, uploadStatus: "PENDING", downloadUrl: null },
      }),
    ).toBeNull();
  });

  it("returns null when the clip has no audio", () => {
    expect(
      toAudioEngineClip({
        _id: "clip-1",
        start: 0,
        duration: 100,
        audioOffset: 0,
      }),
    ).toBeNull();
  });

  it("keeps only READY audios from the project library", () => {
    const audio2 = {
      _id: "audio-2",
      uploadStatus: "READY",
      downloadUrl: "https://example.com/audio-2",
    };
    const pending = {
      _id: "audio-3",
      uploadStatus: "PENDING",
      downloadUrl: null,
    };
    expect(filterReadyAudios([readyAudio, audio2, pending])).toEqual([
      readyAudio,
      audio2,
    ]);
  });

  it("merges library audios with clip-referenced audios", () => {
    const libraryAudio = {
      _id: "audio-lib",
      uploadStatus: "READY",
      downloadUrl: "https://example.com/lib",
    };
    const clipOnlyAudio = {
      _id: "audio-clip",
      uploadStatus: "READY",
      downloadUrl: "https://example.com/clip",
    };
    const pendingClipAudio = {
      _id: "audio-pending",
      uploadStatus: "PENDING",
      downloadUrl: null,
    };
    expect(
      collectProjectAudios([libraryAudio], [
        {
          _id: "clip-1",
          start: 0,
          duration: 100,
          audioOffset: 0,
          audio: clipOnlyAudio,
        },
        {
          _id: "clip-2",
          start: 100,
          duration: 50,
          audioOffset: 0,
          audio: pendingClipAudio,
        },
      ]),
    ).toEqual([libraryAudio, clipOnlyAudio]);
  });
});

describe("ensureAudioLoaded", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetAudioLoaderForTests();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fetchMock.mockReset();
  });

  function makeEngine() {
    const ctx = {
      currentTime: 0,
      state: "running" as const,
      destination: {} as AudioDestinationNode,
      createGain: () =>
        ({
          gain: { value: 1 },
          connect: jest.fn(),
          disconnect: jest.fn(),
        }) as unknown as GainNode,
      createBufferSource: () =>
        ({
          buffer: null,
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        }) as unknown as AudioBufferSourceNode,
      decodeAudioData: jest.fn(() =>
        Promise.resolve({ duration: 1 } as AudioBuffer),
      ),
      resume: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    const engine = new AudioEngine({
      contextFactory: () => ctx as unknown as AudioContext,
    });
    return { engine, ctx };
  }

  const readyAudio = {
    _id: "audio-1",
    uploadStatus: "READY",
    downloadUrl: "https://example.com/audio-1",
  };

  it("fetches and decodes audio into the engine", async () => {
    const { engine } = makeEngine();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(bytes),
    });

    await ensureAudioLoaded(engine, readyAudio);

    expect(fetchMock).toHaveBeenCalledWith(readyAudio.downloadUrl);
    expect(engine.hasAudio("audio-1")).toBe(true);
  });

  it("skips fetch when audio is already loaded", async () => {
    const { engine } = makeEngine();
    engine.setAudioBuffer("audio-1", { duration: 1 } as AudioBuffer);

    await ensureAudioLoaded(engine, readyAudio);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips PENDING audio", async () => {
    const { engine } = makeEngine();

    await ensureAudioLoaded(engine, {
      ...readyAudio,
      uploadStatus: "PENDING",
      downloadUrl: null,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(engine.hasAudio("audio-1")).toBe(false);
  });

  it("deduplicates concurrent loads for the same id", async () => {
    const { engine } = makeEngine();
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = ensureAudioLoaded(engine, readyAudio);
    const second = ensureAudioLoaded(engine, readyAudio);

    resolveFetch({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    });

    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(engine.hasAudio("audio-1")).toBe(true);
  });

  it("throws when the download fails", async () => {
    const { engine } = makeEngine();
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(ensureAudioLoaded(engine, readyAudio)).rejects.toThrow(
      /Failed to fetch audio audio-1 \(404\)/,
    );
  });
});
