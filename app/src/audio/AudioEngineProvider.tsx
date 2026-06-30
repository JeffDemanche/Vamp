import { useQuery } from "@apollo/client/react";
import * as React from "react";

import {
  defaultAudioDeviceId,
  enumerateAudioDevices,
  audioOutputSelectionSupported,
  type AudioDevice,
} from "@/audio/audioDevices";
import { ProjectQuery } from "@/projects/queries";
import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline";
import { ensureAudioLoaded } from "./audioLoader";
import { AudioEngine, type AudioEngineState } from "./AudioEngine";
import { collectProjectAudios, toAudioEngineClip } from "./clipMapping";

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
      for (const audio of collectProjectAudios(audios, clips)) {
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

/**
 * The decoded {@link AudioBuffer} for an audio id, or `null` until the engine
 * has downloaded and decoded it (the provider streams the project's audio in
 * the background). Re-renders when the buffer lands, so clip waveforms can draw
 * straight from the engine's in-memory bytes without re-fetching the file. Pass
 * `null`/`undefined` for clips with no audio to skip the subscription.
 */
export function useAudioBuffer(audioId: string | null | undefined): AudioBuffer | null {
  const engine = useAudioEngine();
  return React.useSyncExternalStore(
    (onChange) => engine.subscribeAudioStore(onChange),
    () => (audioId ? engine.getAudioBuffer(audioId) ?? null : null),
  );
}

/**
 * The PCM captured so far during an active recording, resampled to the timeline
 * sample rate, or `null` when not recording. Re-renders as the mic tap appends
 * frames so the live `RecordingClip` waveform can track the take.
 */
export function useRecordingBuffer(): AudioBuffer | null {
  const engine = useAudioEngine();
  return React.useSyncExternalStore(
    (onChange) => engine.subscribeRecordingBuffer(onChange),
    () => engine.getRecordingBuffer() ?? null,
  );
}

/**
 * How much audio has been captured during the active recording, in timeline
 * samples. Polled on `requestAnimationFrame` while `active` so the live
 * `RecordingClip` width tracks capture progress even when the transport loops
 * and the playhead wraps.
 */
export function useRecordingCapturedSamples(active: boolean): number {
  const engine = useAudioEngine();
  const [samples, setSamples] = React.useState(() =>
    engine.getRecordingCapturedSamples(),
  );

  React.useEffect(() => {
    if (!active) {
      setSamples(engine.getRecordingCapturedSamples());
      return;
    }
    let raf = 0;
    const tick = () => {
      setSamples(engine.getRecordingCapturedSamples());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, active]);

  return samples;
}

/**
 * Whether playback has looped at least once during the active recording. Polled
 * on `requestAnimationFrame` while `active` so the live `RecordingClip` stays
 * anchored at `playStart` after the first loop-back.
 */
export function useRecordingCrossedLoop(active: boolean): boolean {
  const engine = useAudioEngine();
  const [crossed, setCrossed] = React.useState(() =>
    engine.hasRecordingCrossedLoop(),
  );

  React.useEffect(() => {
    if (!active) {
      setCrossed(engine.hasRecordingCrossedLoop());
      return;
    }
    let raf = 0;
    const tick = () => {
      setCrossed(engine.hasRecordingCrossedLoop());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, active]);

  return crossed;
}

/** Subscribe to the engine's playing state, re-rendering when it flips. */
export function useAudioEnginePlaying(): boolean {
  const engine = useAudioEngine();
  return React.useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.isPlaying,
  );
}

export type AudioDevicesState = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  inputDeviceId: string;
  outputDeviceId: string;
  setInputDeviceId: (deviceId: string) => void;
  setOutputDeviceId: (deviceId: string) => void;
  /** Whether the browser exposes output routing via `AudioContext.setSinkId`. */
  outputSelectionSupported: boolean;
};

/**
 * Enumerates audio input/output devices and keeps the editor's `AudioEngine`
 * in sync with the user's selections.
 */
export function useAudioDevices(): AudioDevicesState {
  const engine = useAudioEngine();
  const defaultId = defaultAudioDeviceId();
  const [inputs, setInputs] = React.useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = React.useState<AudioDevice[]>([]);
  const [inputDeviceId, setInputDeviceIdState] = React.useState(
    () => engine.getInputDeviceId() ?? defaultId,
  );
  const [outputDeviceId, setOutputDeviceIdState] = React.useState(
    () => engine.getOutputDeviceId() ?? defaultId,
  );
  const outputSelectionSupported = audioOutputSelectionSupported();

  const setInputDeviceId = React.useCallback(
    (deviceId: string) => {
      setInputDeviceIdState(deviceId);
      engine.setInputDeviceId(deviceId === defaultId ? null : deviceId);
    },
    [defaultId, engine],
  );

  const setOutputDeviceId = React.useCallback(
    (deviceId: string) => {
      setOutputDeviceIdState(deviceId);
      engine.setOutputDeviceId(deviceId === defaultId ? null : deviceId);
    },
    [defaultId, engine],
  );

  React.useEffect(() => {
    let active = true;

    async function refreshDevices(): Promise<void> {
      const listed = await enumerateAudioDevices();
      if (!active) return;
      setInputs(listed.inputs);
      setOutputs(listed.outputs);
    }

    void refreshDevices();
    navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
    };
  }, []);

  return {
    inputs,
    outputs,
    inputDeviceId,
    outputDeviceId,
    setInputDeviceId,
    setOutputDeviceId,
    outputSelectionSupported,
  };
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
