import { useQuery } from "@apollo/client/react";
import * as React from "react";

import { ProjectQuery } from "@/projects/queries";
import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline";
import { ensureAudioLoaded } from "./audioLoader";
import { AudioEngine, type AudioEngineState } from "./AudioEngine";
import { filterReadyAudios, toAudioEngineClip } from "./clipMapping";

/**
 * Owns a single {@link AudioEngine} instance scoped to one timeline editor and
 * keeps it in sync with the editor's jotai state and the project's content.
 * Must be rendered inside the editor's jotai `Provider` (it reads the timeline
 * atoms) so the engine resets with the editor.
 *
 * The engine is reflected — never read back into — from React: an effect pushes
 * the relevant editor state (clips, sample rate, playback range/loop) into
 * `engine.update`. In parallel it downloads the project's whole audio library
 * (`projectData.audios`, keyed by `ProjectAudio._id`) from each audio's
 * `downloadUrl` into the engine's in-memory store, so clips can reference any
 * of it without enumerating the timeline. Components read transport state
 * through the hooks below.
 */

const AudioEngineContext = React.createContext<AudioEngine | null>(null);

export function AudioEngineProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [engine] = React.useState(() => new AudioEngine());
  const { data } = useQuery(ProjectQuery, { variables: { id: projectId } });
  const clips = data?.project?.projectData.clips ?? [];
  const audios = data?.project?.projectData.audios ?? [];

  const { sampleRate } = useTimelineViewport();
  const { playStart, playEnd, loop } = useTimelinePlayback();

  const engineState = React.useMemo<AudioEngineState>(
    () => ({
      clips: clips
        .map(toAudioEngineClip)
        .filter((clip): clip is NonNullable<typeof clip> => clip !== null),
      sampleRate,
      playStart,
      playEnd,
      loop,
    }),
    [clips, sampleRate, playStart, playEnd, loop],
  );

  // Reflect clip/transport state immediately; download the project's audio
  // library in the background and re-schedule once buffers land.
  React.useEffect(() => {
    engine.update(engineState);

    let cancelled = false;

    void (async () => {
      for (const audio of filterReadyAudios(audios)) {
        try {
          await ensureAudioLoaded(engine, audio);
        } catch (err) {
          console.error("Failed to load project audio", audio._id, err);
        }
        if (cancelled) return;
      }
      engine.update(engineState);
    })();

    return () => {
      cancelled = true;
    };
  }, [engine, engineState, audios]);

  React.useEffect(() => () => engine.dispose(), [engine]);

  return (
    <AudioEngineContext.Provider value={engine}>
      {children}
    </AudioEngineContext.Provider>
  );
}

/** Access the editor's {@link AudioEngine}. Throws outside an `AudioEngineProvider`. */
export function useAudioEngine(): AudioEngine {
  const engine = React.useContext(AudioEngineContext);
  if (!engine) {
    throw new Error("useAudioEngine must be used within an AudioEngineProvider");
  }
  return engine;
}

/** Subscribe to the engine's playing state, re-rendering when it flips. */
export function useAudioEnginePlaying(): boolean {
  const engine = useAudioEngine();
  return React.useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.isPlaying,
  );
}

/**
 * The engine's current timeline position (in samples), polled on
 * `requestAnimationFrame` while `active` so the UI can track playback smoothly.
 * When inactive it returns the last/cued position without animating.
 */
export function useAudioEngineTimecode(active: boolean): number {
  const engine = useAudioEngine();
  const [sample, setSample] = React.useState(() => engine.timecode);

  React.useEffect(() => {
    if (!active) {
      setSample(engine.timecode);
      return;
    }
    let raf = 0;
    const tick = () => {
      setSample(engine.timecode);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, active]);

  return sample;
}
