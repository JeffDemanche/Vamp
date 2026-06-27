import * as React from "react";

import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline";
import { AudioEngine } from "./AudioEngine";

/**
 * Owns a single {@link AudioEngine} instance scoped to one timeline editor and
 * keeps it in sync with the editor's jotai state. Must be rendered inside the
 * editor's jotai `Provider` (it reads the timeline atoms) so the engine resets
 * with the editor.
 *
 * The engine is reflected — never read back into — from React: an effect pushes
 * the relevant editor state (sample rate plus the playback range/loop) into
 * `engine.update`, and components read transport state through the hooks below.
 */

const AudioEngineContext = React.createContext<AudioEngine | null>(null);

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const [engine] = React.useState(() => new AudioEngine());

  React.useEffect(() => () => engine.dispose(), [engine]);

  const { sampleRate } = useTimelineViewport();
  const { playStart, playEnd, loop } = useTimelinePlayback();

  React.useEffect(() => {
    // No audio is loaded yet, so the engine has no clips to schedule; it still
    // advances its timecode for the playhead. Clip→audio wiring lands later.
    engine.update({ clips: [], sampleRate, playStart, playEnd, loop });
  }, [engine, sampleRate, playStart, playEnd, loop]);

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
